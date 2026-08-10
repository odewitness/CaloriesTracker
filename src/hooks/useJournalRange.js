import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

function fmt(date) {
  if (typeof date === 'string') return date
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─────────────────────────────────────────────────────────────────────────────
// useJournalRange — équivalent de useJournal(date) mais pour une PLAGE de
// dates en une seule requête (vue calendrier mois/semaine), regroupée par
// date. Évite d'appeler useJournal() une fois par jour affiché (30+ requêtes
// pour une vue mois).
// ─────────────────────────────────────────────────────────────────────────────
export function useJournalRange(startDate, endDate) {
  const { user } = useAuth()
  const [byDate, setByDate] = useState({})
  const [loading, setLoading] = useState(true)

  const start = fmt(startDate)
  const end = fmt(endDate)

  const fetchRange = useCallback(async () => {
    if (!user?.id || !start || !end) { setByDate({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('created_at', { ascending: true })
    const grouped = {}
    for (const e of data || []) {
      if (!grouped[e.date]) grouped[e.date] = []
      grouped[e.date].push(e)
    }
    setByDate(grouped)
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { fetchRange() }, [fetchRange])

  return { byDate, loading, refetch: fetchRange }
}
