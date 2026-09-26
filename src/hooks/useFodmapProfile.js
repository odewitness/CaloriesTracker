import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildFodmapProfile } from '../lib/fodmap'

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
