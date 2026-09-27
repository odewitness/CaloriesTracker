import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fetchAllRows } from '../lib/fetchAllRows'
import { addDaysStr } from '../lib/sleep'
import { computeSleepInsights, INSIGHT_WINDOW_DAYS } from '../lib/sleepInsights'

// ─────────────────────────────────────────────────────────────────────────────
// useSleepInsights(endDate, { enabled, settings, cycleDays }) — croisements
// sommeil ↔ journée sur les 90 jours qui finissent à `endDate` (voir
// src/lib/sleepInsights.js). Charge nuits, journal (colonnes utiles
// seulement, paginé), jours exclus, séances et pas de la fenêtre, + la veille
// du premier jour (facteurs « journée → nuit suivante »).
//
// Utilisé par l'onglet Sommeil de l'Historique ET par le conseil du jour après
// une nuit courte : même fonction, mêmes données — une seule source de vérité.
// `enabled` = false → aucune requête (ex. page du jour sans nuit courte).
// ─────────────────────────────────────────────────────────────────────────────
export function useSleepInsights(endDate, { enabled = true, settings, cycleDays } = {}) {
  const { user } = useAuth()
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(false)
  const start = endDate ? addDaysStr(endDate, -INSIGHT_WINDOW_DAYS) : null

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!enabled || !user?.id || !endDate) { setRaw(null); return }
      setLoading(true)
      try {
        const [nights, journal, excl, acts, pas] = await Promise.all([
          supabase.from('sommeil').select('*').eq('user_id', user.id).gte('date', start).lte('date', endDate),
          fetchAllRows(() => supabase.from('journal')
            .select('date, meal, energie_kcal, sucres, lipides, proteines, food_name')
            .eq('user_id', user.id).gte('date', start).lte('date', endDate)
            .order('date', { ascending: true }).order('id', { ascending: true })),
          supabase.from('jours_exclus').select('date').eq('user_id', user.id).gte('date', start).lte('date', endDate),
          supabase.from('activites_sport').select('date, duree_min, heure_debut').eq('user_id', user.id).gte('date', start).lte('date', endDate),
          supabase.from('pas_jour').select('date, nb_pas').eq('user_id', user.id).gte('date', start).lte('date', endDate),
        ])
        if (cancelled) return
        const pasByDate = {}
        for (const p of pas.data || []) pasByDate[p.date] = Number(p.nb_pas) || 0
        setRaw({
          nights: nights.data || [],
          journal,
          excludedDates: new Set((excl.data || []).map(r => r.date)),
          activities: acts.data || [],
          pasByDate,
        })
      } catch (e) {
        console.error('useSleepInsights', e)
        if (!cancelled) setRaw(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [enabled, user?.id, endDate, start])

  const insights = useMemo(() => {
    if (!raw || !settings) return null
    return computeSleepInsights({ ...raw, settings, cycleDays, endDate })
  }, [raw, settings, cycleDays, endDate])

  return { insights, loading }
}
