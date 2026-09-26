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

// Réglages FODMAP des aliments perso (aliments_custom.fodmap). Cache de
// session vidé par forgetCustomFodmap() quand la fiche est enregistrée.
const customCache = new Map()
const pendingCustom = new Map()

export function forgetCustomFodmap(id) {
  if (id != null) customCache.delete(String(id))
}

async function ensureCustomOverrides(ids) {
  const missing = ids.filter(c => !customCache.has(c) && !pendingCustom.has(c))
  if (missing.length) {
    const p = supabase.from('aliments_custom').select('id, fodmap').in('id', missing)
      .then(({ data, error }) => {
        for (const c of missing) pendingCustom.delete(c)
        if (error) throw error
        for (const c of missing) customCache.set(c, null)
        for (const r of data || []) customCache.set(String(r.id), r.fodmap || null)
      })
    for (const c of missing) pendingCustom.set(c, p)
  }
  await Promise.all(ids.map(c => pendingCustom.get(c)).filter(Boolean))
}

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const customIdsOf = (rows) => [...new Set(rows
  .filter(r => r.food_source === 'custom' && isUuid(String(r.food_ref_id)))
  .map(r => String(r.food_ref_id)))].sort()

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
      await Promise.all([
        ensureCiqualRows([...new Set((ings || [])
          .filter(i => i.food_source === 'ciqual' && i.food_ref_id != null)
          .map(i => String(i.food_ref_id)))]),
        ensureCustomOverrides(customIdsOf(ings || [])).catch(() => {}),
      ])
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
  const override = row.food_source === 'custom' && row.food_ref_id != null
    ? customCache.get(String(row.food_ref_id)) ?? null
    : undefined
  return buildFodmapProfile(entryToFood(row), ciq, override)
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
  // Aliment perso reconstruit depuis le journal (pas de `fodmap` porté) :
  // son réglage FODMAP est relu dans aliments_custom.
  const customId = !!food && food._source === 'custom' && !('fodmap' in food) && isUuid(String(food.id))
    ? String(food.id) : null
  const key = `${code}|${customId}`
  const ready = (!code || rowCache.has(code)) && (!customId || customCache.has(customId))
  // Clé dont le chargement a été tenté (réussi ou non) : en cas d'erreur
  // réseau, on calcule quand même avec les valeurs portées par l'aliment.
  const [settledKey, setSettledKey] = useState(null)
  const loading = enabled && !ready && settledKey !== key

  useEffect(() => {
    if (!enabled || ready) return
    let cancelled = false
    Promise.all([
      code ? ensureCiqualRows([code]).catch(() => {}) : null,
      customId ? ensureCustomOverrides([customId]).catch(() => {}) : null,
    ]).then(() => { if (!cancelled) setSettledKey(key) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const profile = useMemo(
    () => (enabled && food && !loading
      ? buildFodmapProfile(
        food,
        code ? rowCache.get(code) ?? null : null,
        customId ? customCache.get(customId) ?? null : undefined,
      )
      : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, food, loading, settledKey, code, customId],
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


// ── Journal : chargement groupé + cumul par repas ───────────────────────────
// Charge en une fois tout ce qu'il faut pour évaluer une liste d'entrées de
// journal : lignes Ciqual, réglages des aliments perso, recettes et leurs
// ingrédients. Renvoie { loading, recipes }.
function useFodmapSources(mealEntries, enabled) {
  const codes = useMemo(() => [...new Set(
    mealEntries.filter(e => e.food_source === 'ciqual' && e.food_ref_id != null).map(e => String(e.food_ref_id)),
  )].sort(), [mealEntries])
  const recipeIds = useMemo(() => [...new Set(
    mealEntries.filter(e => e.food_source === 'recette' && e.food_ref_id).map(e => String(e.food_ref_id)),
  )].sort(), [mealEntries])
  const customIds = useMemo(() => customIdsOf(mealEntries), [mealEntries])
  const loadKey = `${codes.join(',')}|${recipeIds.join(',')}|${customIds.join(',')}`
  const [loaded, setLoaded] = useState({ key: null, recipes: {} })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([
      ensureCiqualRows(codes).catch(() => {}),
      ensureCustomOverrides(customIds).catch(() => {}),
      recipeIds.length ? loadRecipes(recipeIds).catch(() => ({})) : {},
    ]).then(([, , recipes]) => {
      // En cas d'erreur réseau, on calcule quand même : les aliments
      // retombent sur les valeurs portées par les entrées, les recettes
      // introuvables ne sont pas comptées.
      if (!cancelled) setLoaded({ key: loadKey, recipes })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, enabled])

  return { loading: enabled && loaded.key !== loadKey, recipes: loaded.recipes }
}

// Cumul par repas d'entrées de journal (sources déjà chargées). Une recette
// compte pour ses ingrédients (chacun à sa part de la portion mangée).
function evaluateMeals(mealEntries, mealNames, recipes) {
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
      const recipeItems = recipeFodmapItems(recipes[e.food_ref_id], e.qty_g, e.ingredients_detail)
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
}

// Journal d'un jour (Palier 2, recettes au Palier 3). Renvoie
// { meals: { [repas]: evaluateMeal(...) }, loading } ; meals = null tant que
// c'est désactivé ou en chargement.
export function useDayFodmap(entries, mealNames, enabled) {
  const mealEntries = useMemo(
    () => (enabled ? entries.filter(e => mealNames.includes(e.meal)) : []),
    [entries, mealNames, enabled],
  )
  const { loading, recipes } = useFodmapSources(mealEntries, enabled)
  const meals = useMemo(
    () => (!enabled || loading ? null : evaluateMeals(mealEntries, mealNames, recipes)),
    [enabled, loading, mealEntries, mealNames, recipes],
  )
  return { meals, loading }
}

// Journal d'une période (Palier 4, corrélations de l'onglet Digestion).
// `days` : { 'YYYY-MM-DD': entrées journal[] }. Renvoie
// { byDate: { [date]: { any, groups: { oligo, fructose, polyols, lactose } } }, loading } :
// pour chaque jour avec au moins un aliment dans un repas, si au moins un
// repas est modéré, élevé ou probablement élevé — toutes familles (`any`) et
// famille par famille.
const CHARGED = new Set(['likely-high', 'moderate', 'high'])
export function usePeriodFodmap(days, mealNames, enabled) {
  const mealEntries = useMemo(
    () => (enabled ? Object.values(days || {}).flat().filter(e => mealNames.includes(e.meal)) : []),
    [days, mealNames, enabled],
  )
  const { loading, recipes } = useFodmapSources(mealEntries, enabled)
  const byDate = useMemo(() => {
    if (!enabled || loading) return null
    const byDay = {}
    for (const e of mealEntries) (byDay[e.date] ||= []).push(e)
    const out = {}
    for (const [date, rows] of Object.entries(byDay)) {
      const meals = Object.values(evaluateMeals(rows, mealNames, recipes)).filter(m => m.overall)
      if (!meals.length) continue
      const groups = {}
      for (const m of meals) for (const r of m.rows) groups[r.key] = groups[r.key] || CHARGED.has(r.level)
      out[date] = { any: meals.some(m => CHARGED.has(m.overall)), groups }
    }
    return out
  }, [enabled, loading, mealEntries, mealNames, recipes])
  return { byDate, loading }
}
