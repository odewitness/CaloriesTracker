import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

// Clé d'identité utilisée pour fusionner deux occurrences du même aliment
// dans une liste. Basée sur la source + réf quand elles sont connues
// (ciqual/custom, via recette_ingredients ou FoodPicker), sinon sur le nom
// normalisé (items ajoutés manuellement, ou aliments Open Food Facts sans
// identifiant stable dans l'app).
export function itemIdentity(item) {
  if (item.food_source && item.food_ref_id) return `${item.food_source}:${item.food_ref_id}`
  return `manual:${normalize(item.nom)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// useShoppingLists — CRUD des listes de courses (listes_courses)
// ─────────────────────────────────────────────────────────────────────────────
export function useShoppingLists() {
  const { user } = useAuth()
  const [listes, setListes]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setListes([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('listes_courses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setListes(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const createListe = async (nom) => {
    const { data, error } = await supabase
      .from('listes_courses')
      .insert([{ nom: nom.trim() || 'Nouvelle liste', user_id: user.id }])
      .select()
      .single()
    if (!error) setListes(l => [data, ...l])
    return { data, error }
  }

  const renameListe = async (id, nom) => {
    const { error } = await supabase
      .from('listes_courses')
      .update({ nom: nom.trim() })
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) setListes(l => l.map(x => x.id === id ? { ...x, nom: nom.trim() } : x))
    return { error }
  }

  const deleteListe = async (id) => {
    const { error } = await supabase
      .from('listes_courses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) setListes(l => l.filter(x => x.id !== id))
    return { error }
  }

  return { listes, loading, createListe, renameListe, deleteListe, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useShoppingListItems — items d'une liste, ajout avec fusion, coché, suppression
// ─────────────────────────────────────────────────────────────────────────────
export function useShoppingListItems(listeId) {
  const { user } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!listeId || !user) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('liste_courses_items')
      .select('*')
      .eq('liste_id', listeId)
      .eq('user_id', user.id)
      .order('nom', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }, [listeId, user])

  useEffect(() => { load() }, [load])

  // ── Résout la catégorie des ingrédients issus d'une recette. ──────────────
  // recette_ingredients ne stocke pas la catégorie : on la retrouve via
  // ciqual (food_source='ciqual' → alim_code) ou aliments_custom
  // (food_source='custom' → id). Les items Open Food Facts ('off') n'ont
  // pas de table de référence ici → 'Autre'.
  const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '')
  const resolveCategories = async (ingredients) => {
    const ciqualCodes = ingredients.filter(i => i.food_source === 'ciqual' && i.food_ref_id && i.food_ref_id !== 'undefined').map(i => i.food_ref_id)
    // Garde uniquement des uuid valides : aliments_custom.id est de type uuid,
    // une valeur parasite ("undefined", un code Ciqual, un code-barres OFF)
    // ferait échouer tout le .in() côté Postgres.
    const customIds    = ingredients.filter(i => i.food_source === 'custom' && isUuid(i.food_ref_id)).map(i => i.food_ref_id)

    const [{ data: ciqualCats }, { data: customCats }] = await Promise.all([
      ciqualCodes.length
        ? supabase.from('ciqual').select('alim_code, categorie').in('alim_code', ciqualCodes)
        : Promise.resolve({ data: [] }),
      customIds.length
        ? supabase.from('aliments_custom').select('id, categorie').in('id', customIds)
        : Promise.resolve({ data: [] }),
    ])

    const catMap = new Map()
    for (const c of ciqualCats || []) catMap.set(`ciqual:${c.alim_code}`, c.categorie)
    for (const c of customCats || []) catMap.set(`custom:${c.id}`, c.categorie)

    return ingredients.map(i => ({
      ...i,
      categorie: catMap.get(`${i.food_source}:${i.food_ref_id}`) || 'Autre',
    }))
  }

  // ── Ajoute un lot d'articles à la liste, en fusionnant avec l'existant
  // (même identité = même ligne, grammages additionnés, noms de recette
  // regroupés). articlesToAdd: [{ nom, categorie, qty_g, food_source?,
  // food_ref_id?, recetteNom? }]
  const addItems = async (articlesToAdd) => {
    if (!user || !listeId || articlesToAdd.length === 0) return { error: null }

    // 1. Pré-agrège le lot lui-même par identité : plusieurs occurrences du
    //    même ingrédient dans un même appel (recette utilisée N fois dans la
    //    semaine, ingrédient partagé entre recettes…) → grammages additionnés,
    //    noms de recette fusionnés. Sans ça, seule la 1ʳᵉ occurrence était
    //    insérée (la fusion des suivantes tentait un update sur une ligne pas
    //    encore créée → total perdu, « une seule portion »).
    const batch = new Map()
    for (const art of articlesToAdd) {
      const key = itemIdentity(art)
      const cur = batch.get(key)
      if (cur) {
        cur.qty_g = (cur.qty_g == null && art.qty_g == null) ? null : (cur.qty_g || 0) + (art.qty_g || 0)
        if (art.recetteNom) cur.noms.add(art.recetteNom)
      } else {
        batch.set(key, {
          nom: art.nom,
          categorie: art.categorie,
          qty_g: art.qty_g ?? null,
          food_source: art.food_source || null,
          food_ref_id: art.food_ref_id || null,
          noms: new Set(art.recetteNom ? [art.recetteNom] : []),
        })
      }
    }

    // 2. Fusionne avec les lignes déjà présentes dans la liste.
    const existingByKey = new Map(items.map(it => [itemIdentity(it), it]))
    const toInsert = []
    const toUpdate = []

    for (const [key, art] of batch) {
      const artNoms = [...art.noms]
      const existing = existingByKey.get(key)
      if (existing) {
        const mergedNoms = [...new Set([...(existing.recette_noms || []), ...artNoms])]
        // Grammages arrondis au gramme : une liste de courses n'a pas besoin
        // de décimales, et la mise à l'échelle d'ingrédients de recette
        // (1 / nb_portions) produit sinon des "33,3333…".
        const mergedQty = (existing.qty_g == null && art.qty_g == null)
          ? null
          : Math.round((existing.qty_g || 0) + (art.qty_g || 0))
        toUpdate.push({ id: existing.id, qty_g: mergedQty, recette_noms: mergedNoms })
      } else {
        toInsert.push({
          liste_id: listeId,
          user_id: user.id,
          nom: art.nom,
          categorie: art.categorie || 'Autre',
          qty_g: art.qty_g == null ? null : Math.round(art.qty_g),
          food_source: art.food_source,
          food_ref_id: art.food_ref_id,
          recette_noms: artNoms,
          checked: false,
        })
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('liste_courses_items').insert(toInsert)
      if (error) return { error }
    }
    for (const u of toUpdate) {
      const { error } = await supabase
        .from('liste_courses_items')
        .update({ qty_g: u.qty_g, recette_noms: u.recette_noms })
        .eq('id', u.id)
      if (error) return { error }
    }

    await load()
    return { error: null }
  }

  // ── Ajoute les ingrédients (déjà filtrés si sélection partielle) d'une
  // recette, en résolvant leur catégorie au préalable. ──────────────────────
  const addRecetteIngredients = async (recette, ingredients) => {
    const withCategories = await resolveCategories(ingredients)
    const toAdd = withCategories.map(i => ({
      nom: i.food_name,
      categorie: i.categorie,
      qty_g: i.qty_g,
      food_source: i.food_source,
      food_ref_id: i.food_ref_id,
      recetteNom: recette.nom,
    }))
    return addItems(toAdd)
  }

  // ── Ajoute une sélection d'aliments provenant d'un repas type
  // (repas_types), en résolvant leur catégorie au préalable — même logique
  // que pour les ingrédients de recette. mealItems: items du repas type
  // (déjà filtrés/mis à l'échelle si besoin), au format { food_name, qty_g,
  // food_source?, food_ref_id?, ... }. ───────────────────────────────────
  const addRepasItems = async (repas, mealItems) => {
    const withCategories = await resolveCategories(mealItems)
    const toAdd = withCategories.map(i => ({
      nom: i.food_name,
      categorie: i.categorie,
      qty_g: i.qty_g,
      food_source: i.food_source,
      food_ref_id: i.food_ref_id,
      recetteNom: repas.nom,
    }))
    return addItems(toAdd)
  }

  // ── Ajoute tous les aliments d'un lot de repas planifiés (repas_planifies)
  // sur une plage de dates — cœur du "générer la liste de courses depuis mes
  // menus de la semaine" (roadmap §M5). On aplatit les `items` de chaque repas
  // planifié, on résout la catégorie comme pour une recette / un repas type,
  // puis addItems() fait la fusion : un même aliment présent dans plusieurs
  // repas de la plage devient UNE ligne, grammages additionnés, avec le nom de
  // chaque repas d'origine listé dessous. plannedMeals : lignes repas_planifies
  // ({ nom, items }). ───────────────────────────────────────────────────────
  // `multiplier` : facteur appliqué aux grammages (ex. nombre de personnes du
  // planificateur de repas — les repas planifiés sont stockés pour 1 portion).
  //
  // Un item `food_source: 'recette'` (repas planifié par le planificateur : la
  // brique recette y est stockée en UNE ligne agrégée, pour que « marquer
  // mangé » l'ajoute au journal comme une vraie recette) est ré-explosé ici en
  // ses ingrédients mis à l'échelle d'une portion — la liste de courses veut
  // « farine, oignons… », pas « 1 × Curry ».
  const addPlannedItems = async (plannedMeals, { multiplier = 1 } = {}) => {
    const recipeRefIds = [...new Set(
      (plannedMeals || []).flatMap(r => (r.items || [])
        .filter(it => it.food_source === 'recette' && isUuid(it.food_ref_id))
        .map(it => it.food_ref_id)),
    )]
    const ingByRecipe = {}
    const recipeMeta = {}
    if (recipeRefIds.length) {
      const [{ data: ings }, { data: recs }] = await Promise.all([
        supabase.from('recette_ingredients').select('*').in('recette_id', recipeRefIds).eq('user_id', user.id),
        supabase.from('recettes').select('id, portions').in('id', recipeRefIds).eq('user_id', user.id),
      ])
      for (const ing of ings || []) (ingByRecipe[ing.recette_id] = ingByRecipe[ing.recette_id] || []).push(ing)
      for (const r of recs || []) recipeMeta[r.id] = r
    }

    const flat = []
    for (const repas of plannedMeals || []) {
      for (const it of (repas.items || [])) {
        if (it.food_source === 'recette' && ingByRecipe[it.food_ref_id]) {
          const parts = recipeMeta[it.food_ref_id]?.portions || 1
          // `it.portions` (planificateur) : 2 = plat servi en double ce jour-là
          // → deux portions d'ingrédients dans la liste. Absent = 1 (plans
          // appliqués avant cette option, ajouts manuels).
          const f = (parts > 0 ? 1 / parts : 1) * (it.portions || 1)
          for (const ing of ingByRecipe[it.food_ref_id]) {
            flat.push({
              food_name: ing.food_name,
              food_source: ing.food_source,
              food_ref_id: ing.food_ref_id,
              qty_g: ing.qty_g != null ? ing.qty_g * f : null,
              _repasNom: repas.nom,
            })
          }
        } else {
          flat.push({ ...it, _repasNom: repas.nom })
        }
      }
    }
    if (flat.length === 0) return { error: null }
    const withCategories = await resolveCategories(flat)
    const toAdd = withCategories.map(i => ({
      nom: i.food_name,
      categorie: i.categorie,
      qty_g: i.qty_g != null ? i.qty_g * multiplier : null,
      food_source: i.food_source,
      food_ref_id: i.food_ref_id,
      recetteNom: i._repasNom,
    }))
    return addItems(toAdd)
  }

  // ── Ajoute un aliment suggéré (voir useGroceriesSuggestions), en résolvant
  // sa catégorie au préalable — même logique que pour les ingrédients de
  // recette/repas type. suggestion : { food_source, food_ref_id, food_name }.
  const addSuggestedItem = async (suggestion) => {
    const [withCategory] = await resolveCategories([{
      food_source: suggestion.food_source,
      food_ref_id: suggestion.food_ref_id,
      food_name: suggestion.food_name,
    }])
    return addItems([{
      nom: suggestion.food_name,
      categorie: withCategory.categorie,
      qty_g: null,
      food_source: suggestion.food_source,
      food_ref_id: suggestion.food_ref_id,
    }])
  }

  const toggleChecked = async (id, checked) => {
    setItems(it => it.map(x => x.id === id ? { ...x, checked } : x)) // optimiste
    const { error } = await supabase
      .from('liste_courses_items')
      .update({ checked })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load() // rollback si échec réseau
    return { error }
  }

  const deleteItem = async (id) => {
    setItems(it => it.filter(x => x.id !== id))
    const { error } = await supabase
      .from('liste_courses_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    return { error }
  }

  const clearChecked = async () => {
    const checkedIds = items.filter(i => i.checked).map(i => i.id)
    if (checkedIds.length === 0) return { error: null }
    setItems(it => it.filter(x => !x.checked))
    const { error } = await supabase
      .from('liste_courses_items')
      .delete()
      .in('id', checkedIds)
      .eq('user_id', user.id)
    return { error }
  }

  // Vide entièrement la liste courante (utilisé pour « régénérer à neuf » depuis
  // le planificateur quand un plan a été remplacé).
  const clearAllItems = async () => {
    if (!listeId || !user) return { error: null }
    setItems([])
    const { error } = await supabase
      .from('liste_courses_items')
      .delete()
      .eq('liste_id', listeId)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }

  return { items, loading, addItems, addRecetteIngredients, addRepasItems, addPlannedItems, addSuggestedItem, toggleChecked, deleteItem, clearChecked, clearAllItems, refetch: load }
}