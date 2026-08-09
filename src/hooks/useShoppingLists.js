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
  const resolveCategories = async (ingredients) => {
    const ciqualCodes = ingredients.filter(i => i.food_source === 'ciqual' && i.food_ref_id).map(i => i.food_ref_id)
    const customIds    = ingredients.filter(i => i.food_source === 'custom' && i.food_ref_id).map(i => i.food_ref_id)

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

    const existingByKey = new Map(items.map(it => [itemIdentity(it), it]))
    const toInsert = []
    const toUpdate = []

    for (const art of articlesToAdd) {
      const key = itemIdentity(art)
      const existing = existingByKey.get(key)
      if (existing) {
        const mergedNoms = art.recetteNom && !existing.recette_noms.includes(art.recetteNom)
          ? [...existing.recette_noms, art.recetteNom]
          : existing.recette_noms
        const mergedQty = (existing.qty_g == null && art.qty_g == null)
          ? null
          : (existing.qty_g || 0) + (art.qty_g || 0)
        toUpdate.push({ id: existing.id, qty_g: mergedQty, recette_noms: mergedNoms })
        // Pour fusionner correctement plusieurs ajouts identiques dans le même lot
        existingByKey.set(key, { ...existing, qty_g: mergedQty, recette_noms: mergedNoms })
      } else {
        const newItem = {
          liste_id: listeId,
          user_id: user.id,
          nom: art.nom,
          categorie: art.categorie || 'Autre',
          qty_g: art.qty_g ?? null,
          food_source: art.food_source || null,
          food_ref_id: art.food_ref_id || null,
          recette_noms: art.recetteNom ? [art.recetteNom] : [],
          checked: false,
        }
        toInsert.push(newItem)
        existingByKey.set(key, newItem)
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

  return { items, loading, addItems, addRecetteIngredients, toggleChecked, deleteItem, clearChecked, refetch: load }
}
