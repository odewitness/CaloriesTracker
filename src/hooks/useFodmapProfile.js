import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildFodmapProfile, evaluateMeal } from '../lib/fodmap'
import { entryToFood } from '../lib/journalEntry'

// Colonnes Ciqual utiles au calcul FODMAP. Relues en base plutôt que prises
// sur l'objet aliment : un aliment venant d'une entrée de journal (récents,
// fiche d'une entrée) porte des valeurs figées au moment de l'ajout, parfois
// avant la correction des sucres/polyols Ciqual du 2026-09-26 (voir
// supabase/sql/ciqual_sucres_fix.sql) — et sa catégorie y est perdue.
const CIQUAL_COLS = 'alim_code, alim_nom, categorie, fructose, glucose, lactose, polyols'

// Cache de session des lignes Ciqual (la table ne bouge qu'à un ré-import),
// et requêtes en cours par code pour ne pas relancer la même requête depuis
// les trois jours montés de la page du jour.
const rowCache = new Map()
const pendingRows = new Map()

async function ensureCiqualRows(codes) {
  const missing = codes.filter(c => !rowCache.has(c) && !pendingRows.has(c))
  if (missing.length) {
    const p = supabase.from('ciqual').select(CIQUAL_COLS).in('alim_code', missing)
      .then(({ data, error }) => {
        for (const c of missing) pendingRows.delete(c)
        if (error) throw error
        for (const c of missing) rowCache.set(c, null)
        for (const r of data || []) rowCache.set(String(r.alim_code), r)
      })
    for (const c of missing) pendingRows.set(c, p)
  }
  await Promise.all(codes.map(c => pendingRows.get(c)).filter(Boolean))
}

// Recettes + ingrédients (colonnes utiles au calcul FODMAP). Pas de cache de
// session : une recette peut être modifiée entre deux ouvertures. Seules les
// requêtes identiques en cours sont partagées.
const RECIPE_COLS = 'id, nom, portions, poids_cuit_g, poids_cru_g'
const INGREDIENT_COLS = 'id, recette_id, food_name, food_source, food_ref_id, qty_g, fructose, glucose, lactose, polyols'
const pendingRecipes = new Map()

function loadRecipes(ids) {
  const key = [...ids].sort().join(',')
  if (!pendingRecipes.has(key)) {
    const p = (async () => {
      const [{ data: recs, error: e1 }, { data: ings, error: e2 }] = await Promise.all([
        supabase.from('recettes').select(RECIPE_COLS).in('id', ids),
        supabase.from('recette_ingredients').select(INGREDIENT_COLS).in('recette_id', ids).order('created_at', { ascending: true }),
      ])
      if (e1 || e2) throw e1 || e2
      await ensureCiqualRows([...new Set((ings || [])
        .filter(i => i.food_source === 'ciqual' && i.food_ref_id != null)
        .map(i => String(i.food_ref_id)))])
      const out = {}
      for (const r of recs || []) out[r.id] = { recette: r, ingredients: [] }
      for (const i of ings || []) out[i.recette_id]?.ingredients.push(i)
      return out
    })().finally(() => pendingRecipes.delete(key))
    pendingRecipes.set(key, p)
  }
  return pendingRecipes.get(key)
}

// Profil d'une ligne portant des valeurs déjà mises à l'échelle de qty_g
// (entrée de journal ou ingrédient de recette). null = non évaluable.
function profileForRow(row) {
  if (row.food_source === 'recette' || !(row.qty_g > 0)) return null
  const ciq = row.food_source === 'ciqual' && row.food_ref_id != null
    ? rowCache.get(String(row.food_ref_id)) ?? null
    : null
  return buildFodmapProfile(entryToFood(row), ciq)
}

// Ingrédients d'une portion de `portionG` grammes de recette, au format
// d'evaluateMeal. `snapshot` (journal.ingredients_detail, optionnel) : les
// grammages corrigés au moment de l'ajout — on en reprend les proportions
// (appariées par nom), l'échelle restant donnée par le poids de la recette.
export function recipeFodmapItems(data, portionG, snapshot = null) {
  if (!data) return []
  const ings = data.ingredients.filter(i => i.qty_g > 0)
  const sumRaw = ings.reduce((s, i) => s + Number(i.qty_g), 0)
  const poidsRef = Number(data.recette.poids_cuit_g) || Number(data.recette.poids_cru_g) || sumRaw
  if (!sumRaw || !poidsRef) return []
  const factor = (Number(portionG) || 0) / poidsRef

  let snapQty = null
  const snapSum = (snapshot || []).reduce((s, i) => s + (Number(i.qty_g) || 0), 0)
  if (snapSum > 0) {
    snapQty = new Map()
    for (const s of snapshot) {
      const list = snapQty.get(s.food_name) || []
      list.push(Number(s.qty_g) || 0)
      snapQty.set(s.food_name, list)
    }
  }

  return ings.map(i => {
    const fromSnap = snapQty?.get(i.food_name)?.shift()
    const raw = fromSnap != null ? (fromSnap / snapSum) * sumRaw : Number(i.qty_g)
    return { id: i.id, name: i.food_name, qtyG: raw * factor, profile: profileForRow(i) }
  })
}

export function useFodmapProfile(food, enabled = true) {
  const isCiqual = !!food && (food._source || 'ciqual') === 'ciqual' && food.alim_code != null
  const code = isCiqual ? String(food.alim_code) : null
  const [row, setRow] = useState(() => (code ? rowCache.get(code) ?? null : null))
  const [loading, setLoading] = useState(() => !!code && enabled && !rowCache.has(code))

  useEffect(() => {
    if (!code || !enabled) { setRow(null); setLoading(false); return }
    if (rowCache.has(code)) { setRow(rowCache.get(code)); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    ensureCiqualRows([code])
      .catch(() => {})
      .then(() => {
        if (cancelled) return
        setRow(rowCache.get(code) ?? null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [code, enabled])

  const profile = useMemo(
    () => (enabled && food && !loading ? buildFodmapProfile(food, row) : null),
    [enabled, food, row, loading],
  )
  return { profile, loading }
}

// Recette + ingrédients prêts pour recipeFodmapItems. data = null tant que
// ça charge, ou si la recette est introuvable.
export function useRecipeFodmap(recipeId, enabled = true) {
  const [state, setState] = useState({ data: null, loading: !!recipeId && enabled })

  useEffect(() => {
    if (!recipeId || !enabled) { setState({ data: null, loading: false }); return }
    let cancelled = false
    setState({ data: null, loading: true })
    loadRecipes([String(recipeId)])
      .then(out => { if (!cancelled) setState({ data: out[recipeId] || null, loading: false }) })
      .catch(() => { if (!cancelled) setState({ data: null, loading: false }) })
    return () => { cancelled = true }
  }, [recipeId, enabled])

  return state
}

// ── Journal d'un jour (Palier 2, recettes au Palier 3) ──────────────────────
// Profils FODMAP de toutes les entrées des repas d'un jour — requêtes Ciqual
// et recettes groupées — puis cumul par repas. Une recette compte pour ses
// ingrédients (chacun à sa part de la portion mangée). Renvoie
// { meals: { [repas]: evaluateMeal(...) }, loading } ; meals = null tant que
// c'est désactivé ou en chargement.
export function useDayFodmap(entries, mealNames, enabled) {
  const mealEntries = useMemo(
    () => (enabled ? entries.filter(e => mealNames.includes(e.meal)) : []),
    [entries, mealNames, enabled],
  )
  const codes = useMemo(() => [...new Set(
    mealEntries.filter(e => e.food_source === 'ciqual' && e.food_ref_id != null).map(e => String(e.food_ref_id)),
  )].sort(), [mealEntries])
  const recipeIds = useMemo(() => [...new Set(
    mealEntries.filter(e => e.food_source === 'recette' && e.food_ref_id).map(e => String(e.food_ref_id)),
  )].sort(), [mealEntries])
  const loadKey = `${codes.join(',')}|${recipeIds.join(',')}`
  const [loaded, setLoaded] = useState({ key: null, recipes: {} })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([
      ensureCiqualRows(codes).catch(() => {}),
      recipeIds.length ? loadRecipes(recipeIds).catch(() => ({})) : {},
    ]).then(([, recipes]) => {
      // En cas d'erreur réseau, on calcule quand même : les aliments
      // retombent sur les valeurs portées par les entrées, les recettes
      // introuvables ne sont pas comptées.
      if (!cancelled) setLoaded({ key: loadKey, recipes })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, enabled])

  const loading = enabled && loaded.key !== loadKey

  const meals = useMemo(() => {
    if (!enabled || loading) return null
    const out = {}
    for (const meal of mealNames) {
      const rows = mealEntries.filter(e => e.meal === meal)
      if (!rows.length) continue
      const items = []
      const recipeLevels = {}
      for (const e of rows) {
        if (e.food_source !== 'recette') {
          items.push({ id: e.id, name: e.food_name, qtyG: e.qty_g, profile: profileForRow(e) })
          continue
        }
        const recipeItems = recipeFodmapItems(loaded.recipes[e.food_ref_id], e.qty_g, e.ingredients_detail)
          .map(it => ({ ...it, id: `${e.id}:${it.id}`, name: `${it.name} (${e.food_name})` }))
        const ev = recipeItems.length ? evaluateMeal(recipeItems) : null
        if (!ev?.overall) {
          items.push({ id: e.id, name: e.food_name, qtyG: e.qty_g, profile: null })
          continue
        }
        items.push(...recipeItems)
        recipeLevels[e.id] = { overall: ev.overall }
      }
      const ev = evaluateMeal(items)
      out[meal] = { ...ev, byId: { ...ev.byId, ...recipeLevels } }
    }
    return out
  }, [enabled, loading, mealEntries, mealNames, loaded])

  return { meals, loading }
}
