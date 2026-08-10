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
// useRepasPlanifiesRange — charge tous les repas planifiés d'une plage de
// dates en UNE requête (vue calendrier mois/semaine), regroupés par date.
// Même logique que useJournalRange.
// ─────────────────────────────────────────────────────────────────────────────
export function useRepasPlanifiesRange(startDate, endDate) {
  const { user } = useAuth()
  const [byDate, setByDate] = useState({})
  const [loading, setLoading] = useState(true)

  const start = fmt(startDate)
  const end = fmt(endDate)

  const fetchRange = useCallback(async () => {
    if (!user?.id || !start || !end) { setByDate({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('repas_planifies')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('created_at', { ascending: true })
    const grouped = {}
    for (const r of data || []) {
      if (!grouped[r.date]) grouped[r.date] = []
      grouped[r.date].push(r)
    }
    setByDate(grouped)
    setLoading(false)
  }, [user?.id, start, end])

  useEffect(() => { fetchRange() }, [fetchRange])

  return { byDate, loading, refetch: fetchRange }
}

// ─────────────────────────────────────────────────────────────────────────────
// useRepasPlanifiesForDate — variante ciblée sur UNE seule date (utilisée par
// DayRecapPanel une fois un jour sélectionné dans le calendrier).
// ─────────────────────────────────────────────────────────────────────────────
export function useRepasPlanifiesForDate(date) {
  const { user } = useAuth()
  const [repas, setRepas] = useState([])
  const [loading, setLoading] = useState(true)

  const dateStr = fmt(date)

  const fetchDay = useCallback(async () => {
    if (!user?.id || !dateStr) { setRepas([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('repas_planifies')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .order('created_at', { ascending: true })
    setRepas(data || [])
    setLoading(false)
  }, [user?.id, dateStr])

  useEffect(() => { fetchDay() }, [fetchDay])

  return { repas, loading, refetch: fetchDay }
}

// ─────────────────────────────────────────────────────────────────────────────
// createRepasPlanifie — crée UN repas planifié pour UNE date. Le caller
// (PlanMealModal) boucle sur les dates choisies pour planifier plusieurs
// jours d'un coup.
// ─────────────────────────────────────────────────────────────────────────────
export async function createRepasPlanifie({ userId, date, meal, nom, items, sourceType, sourceId }) {
  const { data, error } = await supabase
    .from('repas_planifies')
    .insert([{
      user_id: userId,
      date: fmt(date),
      meal,
      nom,
      items,
      source_type: sourceType || null,
      source_id: sourceId || null,
    }])
    .select()
    .single()
  return { data, error }
}

export async function deleteRepasPlanifie(id, userId) {
  const { error } = await supabase.from('repas_planifies').delete().eq('id', id).eq('user_id', userId)
  return { error }
}

// ─────────────────────────────────────────────────────────────────────────────
// markAsMange — copie les items du repas planifié dans `journal` (à sa date
// et son repas), puis marque le repas planifié comme mangé. On ne supprime
// PAS la ligne repas_planifies : elle garde la trace de ce qui était prévu
// ce jour-là (utile pour le point violet "planifié" une fois passé à vert).
// ─────────────────────────────────────────────────────────────────────────────
export async function markAsMange(repas, userId) {
  const rows = (repas.items || []).map(item => {
    const { id: _id, user_id: _uid, created_at: _ca, date: _d, meal: _m, ...rest } = item
    return { ...rest, date: repas.date, meal: repas.meal, user_id: userId }
  })
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('journal').insert(rows)
    if (insertError) return { error: insertError }
  }
  const { data, error } = await supabase
    .from('repas_planifies')
    .update({ mange: true, mange_at: new Date().toISOString() })
    .eq('id', repas.id)
    .eq('user_id', userId)
    .select()
    .single()
  return { data, error }
}
