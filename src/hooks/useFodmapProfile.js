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

// Cache de session : une fiche rouverte ne relance pas la requête.
const rowCache = new Map()

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
    supabase.from('ciqual').select(CIQUAL_COLS).eq('alim_code', code).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        rowCache.set(code, data || null)
        setRow(data || null)
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

// ── Journal d'un jour (Palier 2) ────────────────────────────────────────────
// Profils FODMAP de toutes les entrées des repas d'un jour, avec une seule
// requête Ciqual pour les codes pas encore en cache, puis cumul par repas.
// Renvoie { meals: { [repas]: evaluateMeal(...) }, loading } ; meals = null
// tant que c'est désactivé ou en chargement.
export function useDayFodmap(entries, mealNames, enabled) {
  const mealEntries = useMemo(
    () => (enabled ? entries.filter(e => mealNames.includes(e.meal)) : []),
    [entries, mealNames, enabled],
  )
  const codes = useMemo(() => [...new Set(
    mealEntries.filter(e => e.food_source === 'ciqual' && e.food_ref_id != null).map(e => String(e.food_ref_id)),
  )].sort(), [mealEntries])
  const codesKey = codes.join(',')
  const [version, setVersion] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const missing = codes.filter(c => !rowCache.has(c))
    if (!missing.length) return
    let cancelled = false
    supabase.from('ciqual').select(CIQUAL_COLS).in('alim_code', missing)
      .then(({ data, error }) => {
        if (cancelled) return
        // En cas d'erreur réseau, on calcule quand même avec les valeurs
        // portées par les entrées (sans les mettre en cache).
        if (error) { setFailed(true); return }
        for (const c of missing) rowCache.set(c, null)
        for (const r of data || []) rowCache.set(String(r.alim_code), r)
        setVersion(v => v + 1)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey])

  const loading = enabled && !failed && codes.some(c => !rowCache.has(c))

  const meals = useMemo(() => {
    if (!enabled || loading) return null
    const out = {}
    for (const meal of mealNames) {
      const items = mealEntries.filter(e => e.meal === meal).map(e => ({
        id: e.id,
        name: e.food_name,
        qtyG: e.qty_g,
        profile: e.food_source === 'recette'
          ? null
          : buildFodmapProfile(entryToFood(e), e.food_source === 'ciqual' ? rowCache.get(String(e.food_ref_id)) ?? null : null),
      }))
      if (items.length) out[meal] = evaluateMeal(items)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loading, mealEntries, mealNames, version])

  return { meals, loading }
}
