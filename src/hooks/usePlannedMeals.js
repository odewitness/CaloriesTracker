import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// usePlannedMealsRange — charge tous les repas planifiés d'une plage de
// dates en UNE requête (vue calendrier mois/semaine), regroupés par date.
// Même logique que useJournalRange.
// ─────────────────────────────────────────────────────────────────────────────
export function usePlannedMealsRange(startDate, endDate) {
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
// usePlannedMealsForDate — variante ciblée sur UNE seule date (utilisée par
// DayRecapPanel une fois un jour sélectionné dans le calendrier).
// ─────────────────────────────────────────────────────────────────────────────
export function usePlannedMealsForDate(date) {
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
// usePlannedSeries — charge toutes les programmations non mangées de
// l'utilisateur (indépendamment du mois affiché sur le calendrier),
// regroupées par recurrence_group_id : une série récurrente devient UNE
// ligne (nom, repas, plage de dates, nombre d'occurrences) au lieu d'une
// ligne par jour planifié. Une programmation isolée (sans
// recurrence_group_id) reste sa propre ligne. Utilisé par
// PlannedSeriesModal ("Mes programmations") pour supprimer une série
// entière en un clic plutôt que jour par jour.
// ─────────────────────────────────────────────────────────────────────────────
export function usePlannedSeries() {
  const { user } = useAuth()
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSeries = useCallback(async () => {
    if (!user?.id) { setSeries([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('repas_planifies')
      .select('id, date, meal, nom, source_type, recurrence_group_id')
      .eq('user_id', user.id)
      .eq('mange', false)
      .order('date', { ascending: true })
    const groups = new Map()
    for (const r of data || []) {
      const key = r.recurrence_group_id || r.id
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          recurrenceGroupId: r.recurrence_group_id,
          id: r.id,
          nom: r.nom,
          meal: r.meal,
          sourceType: r.source_type,
          dates: [],
        })
      }
      groups.get(key).dates.push(r.date)
    }
    const result = [...groups.values()].map(g => ({
      ...g,
      count: g.dates.length,
      firstDate: g.dates[0],
      lastDate: g.dates[g.dates.length - 1],
    }))
    setSeries(result)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { fetchSeries() }, [fetchSeries])

  return { series, loading, refetch: fetchSeries }
}

// ─────────────────────────────────────────────────────────────────────────────
// createPlannedMeal — crée UN repas planifié pour UNE date. Le caller
// (PlanMealModal) boucle sur les dates choisies pour planifier plusieurs
// jours d'un coup.
// ─────────────────────────────────────────────────────────────────────────────
export async function createPlannedMeal({ userId, date, meal, nom, items, sourceType, sourceId }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// createPlannedMeals — variante batch de createPlannedMeal : insère UNE ligne
// par date en une seule requête (au lieu d'une boucle de N awaits). Si
// plusieurs dates sont fournies (planification récurrente), toutes les lignes
// partagent le même recurrence_group_id, ce qui permet plus tard de les
// supprimer ensemble via deletePlannedMealSeries. Une planification d'un seul
// jour n'a pas de recurrence_group_id (comportement identique à
// createPlannedMeal).
// ─────────────────────────────────────────────────────────────────────────────
export async function createPlannedMeals({ userId, dates, meal, nom, items, sourceType, sourceId }) {
  const recurrenceGroupId = dates.length > 1 ? crypto.randomUUID() : null
  const rows = dates.map(date => ({
    user_id: userId,
    date: fmt(date),
    meal,
    nom,
    items,
    source_type: sourceType || null,
    source_id: sourceId || null,
    recurrence_group_id: recurrenceGroupId,
  }))
  const { data, error } = await supabase.from('repas_planifies').insert(rows).select()
  return { data, error }
}

export async function deletePlannedMeal(id, userId) {
  const { error } = await supabase.from('repas_planifies').delete().eq('id', id).eq('user_id', userId)
  return { error }
}

// Supprime un lot de repas planifiés par ids (ex. les lignes d'un plan généré
// tombant dans une semaine donnée).
export async function deletePlannedMeals(ids, userId) {
  if (!ids?.length) return { error: null }
  const { error } = await supabase.from('repas_planifies').delete().in('id', ids).eq('user_id', userId)
  return { error }
}

// Supprime toutes les occurrences d'une série récurrente (même recurrence_group_id).
export async function deletePlannedMealSeries(recurrenceGroupId, userId) {
  const { error } = await supabase.from('repas_planifies').delete().eq('recurrence_group_id', recurrenceGroupId).eq('user_id', userId)
  return { error }
}

// ─────────────────────────────────────────────────────────────────────────────
// duplicatePlannedMeals — recopie un lot de repas planifiés en décalant leur
// date de `offsetDays` jours (ex. « reprendre la semaine précédente » →
// offsetDays = 7). Toutes les copies partagent UN nouveau recurrence_group_id
// (retrait groupé, comme un plan généré). Les créneaux `date|meal` déjà
// occupés (`skipKeys`) et les dates exclues (`excludedDates`) sont ignorés.
// `mange` / `mange_at` ne sont pas recopiés : les repas repris sont « à faire ».
// ─────────────────────────────────────────────────────────────────────────────
function shiftDateStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

export async function duplicatePlannedMeals(sourceRows, { userId, offsetDays, excludedDates = new Set(), skipKeys = new Set() }) {
  const groupId = crypto.randomUUID()
  const rows = []
  for (const r of sourceRows || []) {
    const date = shiftDateStr(r.date, offsetDays)
    if (excludedDates.has(date)) continue
    if (skipKeys.has(`${date}|${r.meal}`)) continue
    rows.push({
      user_id: userId,
      date,
      meal: r.meal,
      nom: r.nom,
      items: r.items,
      source_type: r.source_type || null,
      source_id: r.source_id || null,
      recurrence_group_id: groupId,
    })
  }
  if (!rows.length) return { data: [], error: null, groupId, inserted: 0 }
  const { data, error } = await supabase.from('repas_planifies').insert(rows).select()
  return { data, error, groupId, inserted: error ? 0 : rows.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// markAsEaten — copie les items du repas planifié dans `journal` (à sa date et
// son repas) ET marque le repas planifié comme mangé, de façon ATOMIQUE via la
// fonction SQL `mark_planned_meal_eaten` (voir
// supabase/sql/mark_planned_meal_eaten_setup.sql). Les deux réussissent ou
// échouent ensemble → plus de cas « aliments ajoutés mais repas encore à
// faire » qui provoquait des doublons quand on recliquait. La fonction est
// idempotente : rappelée sur un repas déjà mangé, elle ne réinsère rien.
//
// On ne supprime PAS la ligne repas_planifies : elle garde la trace de ce qui
// était prévu ce jour-là (point violet "planifié" une fois passé à vert).
//
// `userId` n'est plus utilisé (la fonction SQL s'appuie sur auth.uid()) mais
// reste dans la signature pour ne pas toucher aux appelants.
// ─────────────────────────────────────────────────────────────────────────────
export async function markAsEaten(repas, userId) { // eslint-disable-line no-unused-vars
  const { data, error } = await supabase.rpc('mark_planned_meal_eaten', { p_repas_id: repas.id })
  return { data, error }
}
