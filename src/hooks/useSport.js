import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { weekStart, weekEnd, weeklyStats, sortActivites } from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// useSport(dateStr) — séances de sport (table `activites_sport`).
//
// Charge la SEMAINE (lundi → dimanche) contenant `dateStr` : la page du jour a
// besoin des séances du jour ET du total hebdo pour l'anneau « minutes actives
// cette semaine ».
//
//   activites  : séances de `dateStr`, triées pour l'affichage
//   week       : { minutes, seances, kcal } sur toute la semaine
//   add(payload) / update(id, patch) / remove(id)
// ─────────────────────────────────────────────────────────────────────────────
export function useSport(dateStr) {
  const { user } = useAuth()
  const [rows, setRows] = useState([]) // toutes les séances de la semaine
  const [loading, setLoading] = useState(true)

  const start = dateStr ? weekStart(dateStr) : null
  const end = dateStr ? weekEnd(dateStr) : null

  const load = useCallback(async () => {
    if (!user?.id || !start || !end) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('activites_sport')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { load() }, [load])

  const activites = useMemo(
    () => sortActivites(rows.filter(r => r.date === fmt(dateStr))),
    [rows, dateStr],
  )
  const week = useMemo(() => weeklyStats(rows, dateStr), [rows, dateStr])

  const add = async (payload) => {
    if (!user) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('activites_sport')
      .insert([{ ...payload, date: payload.date || fmt(dateStr), user_id: user.id }])
      .select()
      .single()
    if (!error && data) setRows(r => [...r, data])
    return { data, error }
  }

  const update = async (id, patch) => {
    if (!user) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('activites_sport')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (!error && data) setRows(r => r.map(x => (x.id === id ? data : x)))
    return { data, error }
  }

  const remove = async (id) => {
    if (!user) return { error: 'Non connecté' }
    const prev = rows
    setRows(r => r.filter(x => x.id !== id))
    const { error } = await supabase
      .from('activites_sport')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) setRows(prev)
    return { error }
  }

  return { activites, week, loading, add, update, remove, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useSportStreak(weeks) — charge les ~N dernières semaines de séances (peu de
// lignes) pour calculer la série de semaines consécutives dans l'objectif
// (streakWeeks, src/lib/sport.js). Utilisé par la page Historique.
// ─────────────────────────────────────────────────────────────────────────────
export function useSportStreak(weeks = 16) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const from = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - weeks * 7)
    return fmt(d)
  }, [weeks])

  const load = useCallback(async () => {
    if (!user?.id) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('activites_sport')
      .select('date, duree_min')
      .eq('user_id', user.id)
      .gte('date', from)
    setRows(data || [])
    setLoading(false)
  }, [user?.id, from])

  useEffect(() => { load() }, [load])

  return { rows, loading, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useSportRange(start, end) — séances sur une plage, regroupées par date (vue
// calendrier). Même forme que useJournalRange.
// ─────────────────────────────────────────────────────────────────────────────
export function useSportRange(startDate, endDate) {
  const { user } = useAuth()
  const [byDate, setByDate] = useState({})
  const [loading, setLoading] = useState(true)

  const start = fmt(startDate)
  const end = fmt(endDate)

  const load = useCallback(async () => {
    if (!user?.id || !start || !end) { setByDate({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('activites_sport')
      .select('id, date, type, duree_min, energie_kcal')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
    const grouped = {}
    for (const a of data || []) {
      if (!grouped[a.date]) grouped[a.date] = []
      grouped[a.date].push(a)
    }
    setByDate(grouped)
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { load() }, [load])

  return { byDate, loading, refetch: load }
}
