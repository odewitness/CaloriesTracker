import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { periodBlocks, periodStarts } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// useCycle — jours de règles saisis à la main (table `regles`). UNE LIGNE =
// UN JOUR, avec une `intensite` optionnelle ('leger'|'moyen'|'abondant',
// Palier 7) et des `symptomes` optionnels (Palier 8, voir PERIOD_SYMPTOMS
// dans src/lib/cycle.js). Le calcul de phase se fait côté client à partir de
// la liste complète (voir src/lib/cycle.js).
//
// toggleDay(date)          : ajoute/retire un jour (insert/delete).
// addManyDays(arr)         : import en lot (insert).
// removeDays(arr)          : retire un lot (delete).
// setDaysIntensite(arr, l) : met l'intensité sur un lot de jours (update).
// setDaysSymptomes(arr, s) : met la liste de symptômes sur un lot de jours (update).
// ─────────────────────────────────────────────────────────────────────────────
export function useCycle() {
  const { user } = useAuth()
  const [rows, setRows] = useState([]) // [{ date:'YYYY-MM-DD', intensite:string|null, symptomes:string[]|null }]
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('regles')
      .select('date, intensite, symptomes')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const sortRows = (arr) => {
    const seen = new Set()
    return [...arr]
      .filter(r => (seen.has(r.date) ? false : seen.add(r.date)))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  const days = useMemo(() => rows.map(r => r.date), [rows])
  const intensiteByDate = useMemo(
    () => Object.fromEntries(rows.map(r => [r.date, r.intensite || null])),
    [rows],
  )
  const symptomesByDate = useMemo(
    () => Object.fromEntries(rows.map(r => [r.date, r.symptomes || []])),
    [rows],
  )
  const blocks = useMemo(() => periodBlocks(days), [days])
  const starts = useMemo(() => periodStarts(days), [days])

  const addDay = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    setRows(r => sortRows([...r, { date: dateStr, intensite: null }]))
    const { error } = await supabase
      .from('regles')
      .insert([{ user_id: user.id, date: dateStr }])
    if (error) setRows(r => r.filter(x => x.date !== dateStr))
    return { error }
  }

  const removeDay = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    const prev = rows
    setRows(r => r.filter(x => x.date !== dateStr))
    const { error } = await supabase
      .from('regles')
      .delete()
      .eq('user_id', user.id)
      .eq('date', dateStr)
    if (error) setRows(prev)
    return { error }
  }

  const removeDays = async (dateArr) => {
    if (!user) return { error: 'Non connecté' }
    const set = new Set(dateArr.map(fmt))
    const prev = rows
    setRows(r => r.filter(x => !set.has(x.date)))
    const { error } = await supabase
      .from('regles')
      .delete()
      .eq('user_id', user.id)
      .in('date', [...set])
    if (error) setRows(prev)
    return { error }
  }

  const addManyDays = async (dateArr) => {
    if (!user) return { error: 'Non connecté', added: 0 }
    const known = new Set(days)
    const clean = [...new Set(dateArr.map(fmt))].filter(d => !known.has(d))
    if (!clean.length) return { error: null, added: 0 }
    setRows(r => sortRows([...r, ...clean.map(d => ({ date: d, intensite: null }))]))
    const { error } = await supabase
      .from('regles')
      .insert(clean.map(d => ({ user_id: user.id, date: d })))
    if (error) setRows(r => r.filter(x => !clean.includes(x.date)))
    return { error, added: error ? 0 : clean.length }
  }

  const setDaysIntensite = async (dateArr, level) => {
    if (!user) return { error: 'Non connecté' }
    const set = new Set(dateArr.map(fmt))
    const prev = rows
    setRows(r => r.map(x => (set.has(x.date) ? { ...x, intensite: level || null } : x)))
    const { error } = await supabase
      .from('regles')
      .update({ intensite: level || null })
      .eq('user_id', user.id)
      .in('date', [...set])
    if (error) setRows(prev)
    return { error }
  }

  const setDaysSymptomes = async (dateArr, symptomsArr) => {
    if (!user) return { error: 'Non connecté' }
    const set = new Set(dateArr.map(fmt))
    const clean = [...new Set((symptomsArr || []).map(s => s.trim()).filter(Boolean))]
    const prev = rows
    setRows(r => r.map(x => (set.has(x.date) ? { ...x, symptomes: clean } : x)))
    const { error } = await supabase
      .from('regles')
      .update({ symptomes: clean.length ? clean : null })
      .eq('user_id', user.id)
      .in('date', [...set])
    if (error) setRows(prev)
    return { error }
  }

  const toggleDay = (date) => {
    const dateStr = fmt(date)
    return days.includes(dateStr) ? removeDay(dateStr) : addDay(dateStr)
  }

  return {
    days, blocks, starts, intensiteByDate, symptomesByDate, loading,
    addDay, removeDay, removeDays, addManyDays, setDaysIntensite, setDaysSymptomes, toggleDay,
    refetch: load,
  }
}
