import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
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

// Supprime toutes les occurrences d'une série récurrente (même recurrence_group_id).
export async function deletePlannedMealSeries(recurrenceGroupId, userId) {
  const { error } = await supabase.from('repas_planifies').delete().eq('recurrence_group_id', recurrenceGroupId).eq('user_id', userId)
  return { error }
}

// ─────────────────────────────────────────────────────────────────────────────
// markAsEaten — copie les items du repas planifié dans `journal` (à sa date
// et son repas), puis marque le repas planifié comme mangé. On ne supprime
// PAS la ligne repas_planifies : elle garde la trace de ce qui était prévu
// ce jour-là (utile pour le point violet "planifié" une fois passé à vert).
// ─────────────────────────────────────────────────────────────────────────────
export async function markAsEaten(repas, userId) {
  // `items` peut contenir des champs superflus selon leur origine (ex:
  // recette_id, id, created_at pour un item copié depuis recette_ingredients
  // via AddFromRecipeModal) — on ne garde QUE les colonnes valides sur
  // `journal`, dans la forme exacte produite par scaleFood().
  const JOURNAL_FIELDS = ['food_name', 'food_source', 'food_ref_id', 'qty_g', 'energie_kcal', 'proteines', 'glucides', 'lipides', 'fibres', ...ALL_NUTRIENT_KEYS]
  const rows = (repas.items || []).map(item => {
    const row = { date: repas.date, meal: repas.meal, user_id: userId }
    for (const key of JOURNAL_FIELDS) row[key] = item[key] ?? null
    return row
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
