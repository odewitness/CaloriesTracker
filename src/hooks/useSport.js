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
//   pasJour    : total de pas de `dateStr` (nombre) ou null (Palier 10)
//   pasWeek    : somme des pas sur la semaine
//   setPas(nbPas) : upsert le total du jour (0 / null / vide = supprime la ligne)
// ─────────────────────────────────────────────────────────────────────────────
export function useSport(dateStr) {
  const { user } = useAuth()
  const [rows, setRows] = useState([]) // toutes les séances de la semaine
  const [pasRows, setPasRows] = useState([]) // pas_jour de la semaine
  const [loading, setLoading] = useState(true)

  const start = dateStr ? weekStart(dateStr) : null
  const end = dateStr ? weekEnd(dateStr) : null

  const load = useCallback(async () => {
    if (!user?.id || !start || !end) { setRows([]); setPasRows([]); setLoading(false); return }
    setLoading(true)
    const [{ data: act }, { data: pas }] = await Promise.all([
      supabase
        .from('activites_sport')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true }),
      supabase
        .from('pas_jour')
        .select('date, nb_pas')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end),
    ])
    setRows(act || [])
    setPasRows(pas || [])
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { load() }, [load])

  const activites = useMemo(
    () => sortActivites(rows.filter(r => r.date === fmt(dateStr))),
    [rows, dateStr],
  )
  const week = useMemo(() => weeklyStats(rows, dateStr), [rows, dateStr])

  const pasJour = useMemo(() => {
    const r = pasRows.find(p => p.date === fmt(dateStr))
    return r ? Number(r.nb_pas) : null
  }, [pasRows, dateStr])
  const pasWeek = useMemo(
    () => pasRows.reduce((s, p) => s + (Number(p.nb_pas) || 0), 0),
    [pasRows],
  )

  const setPas = async (nbPas) => {
    if (!user) return { error: 'Non connecté' }
    const d = fmt(dateStr)
    const n = Number(nbPas)
    if (!n || n <= 0) {
      const prev = pasRows
      setPasRows(p => p.filter(x => x.date !== d))
      const { error } = await supabase
        .from('pas_jour').delete().eq('user_id', user.id).eq('date', d)
      if (error) setPasRows(prev)
      return { error }
    }
    const value = Math.round(n)
    const { data, error } = await supabase
      .from('pas_jour')
      .upsert({ user_id: user.id, date: d, nb_pas: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' })
      .select('date, nb_pas')
      .single()
    if (!error && data) {
      setPasRows(p => [...p.filter(x => x.date !== d), data])
    }
    return { data, error }
  }

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

  return { activites, week, pasJour, pasWeek, setPas, loading, add, update, remove, refetch: load }
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
// calendrier + graphe Historique). Même forme que useJournalRange.
//   byDate    : { 'YYYY-MM-DD': [séances] }
//   pasByDate : { 'YYYY-MM-DD': nb_pas } (Palier 10b — courbe des pas)
// ─────────────────────────────────────────────────────────────────────────────
export function useSportRange(startDate, endDate) {
  const { user } = useAuth()
  const [byDate, setByDate] = useState({})
  const [pasByDate, setPasByDate] = useState({})
  const [loading, setLoading] = useState(true)

  const start = fmt(startDate)
  const end = fmt(endDate)

  const load = useCallback(async () => {
    if (!user?.id || !start || !end) { setByDate({}); setPasByDate({}); setLoading(false); return }
    setLoading(true)
    const [{ data: act }, { data: pas }] = await Promise.all([
      supabase
        .from('activites_sport')
        .select('id, date, type, duree_min, energie_kcal, compte_dans_pas')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end),
      supabase
        .from('pas_jour')
        .select('date, nb_pas')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end),
    ])
    const grouped = {}
    for (const a of act || []) {
      if (!grouped[a.date]) grouped[a.date] = []
      grouped[a.date].push(a)
    }
    const pasMap = {}
    for (const p of pas || []) pasMap[p.date] = Number(p.nb_pas) || 0
    setByDate(grouped)
    setPasByDate(pasMap)
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { load() }, [load])

  return { byDate, pasByDate, loading, refetch: load }
}
