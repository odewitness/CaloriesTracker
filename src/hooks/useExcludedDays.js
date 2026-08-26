import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// useExcludedDay — un jour marqué "exclu" reste consultable et modifiable
// normalement (voir DaySlot dans TodayPage.jsx et DayRecapPanel.jsx), il est
// juste ignoré des agrégats de HistoryPage.jsx (moyennes, série en cours,
// jours objectif). Toggle = insert/delete dans jours_exclus, pas de journal
// touché (voir supabase/sql/jours_exclus_setup.sql).
// ─────────────────────────────────────────────────────────────────────────────
export function useExcludedDay(date) {
  const { user } = useAuth()
  const [excluded, setExcluded] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchExcluded = useCallback(async () => {
    if (!date || !user?.id) { setExcluded(false); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('jours_exclus')
      .select('id')
      .eq('date', date)
      .eq('user_id', user.id)
      .maybeSingle()
    setExcluded(!!data)
    setLoading(false)
  }, [date, user?.id])

  useEffect(() => { fetchExcluded() }, [fetchExcluded])

  const toggle = async () => {
    if (!user) return
    if (excluded) {
      setExcluded(false)
      await supabase.from('jours_exclus').delete().eq('date', date).eq('user_id', user.id)
    } else {
      setExcluded(true)
      await supabase.from('jours_exclus').insert([{ date, user_id: user.id }])
    }
  }

  return { excluded, loading, toggle }
}

// ─────────────────────────────────────────────────────────────────────────────
// useExcludedDaysRange — équivalent range de useExcludedDay (même construction
// que useJournalRange), pour HistoryPage (exclure ces dates des agrégats) et
// le calendrier (marqueur visuel sur les jours exclus).
// ─────────────────────────────────────────────────────────────────────────────
export function useExcludedDaysRange(startDate, endDate) {
  const { user } = useAuth()
  const [excludedDates, setExcludedDates] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const start = fmt(startDate)
  const end = fmt(endDate)

  const fetchRange = useCallback(async () => {
    if (!user?.id || !start || !end) { setExcludedDates(new Set()); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('jours_exclus')
      .select('date')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
    setExcludedDates(new Set((data || []).map(r => r.date)))
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { fetchRange() }, [fetchRange])

  return { excludedDates, loading, refetch: fetchRange }
}
