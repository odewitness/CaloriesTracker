import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { periodBlocks, periodStarts } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// useCycle — jours de règles saisis à la main (table `regles`). UNE LIGNE =
// UN JOUR. Le calcul de phase se fait côté client à partir de la liste
// complète (voir src/lib/cycle.js) : quelques dizaines de lignes par an,
// négligeable, donc on charge tout.
//
// toggleDay(date) : ajoute le jour s'il est absent, le retire sinon
// (insert/delete, jamais d'update — même esprit que useExcludedDay).
// removeDays(arr) : retire un lot de jours en une requête (supprimer un bloc).
// ─────────────────────────────────────────────────────────────────────────────
export function useCycle() {
  const { user } = useAuth()
  const [days, setDays] = useState([]) // ['YYYY-MM-DD', ...] triées croissant
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setDays([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('regles')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
    setDays((data || []).map(r => r.date))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const sortDedupe = (arr) => [...new Set(arr)].sort()

  const addDay = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    setDays(d => sortDedupe([...d, dateStr]))
    const { error } = await supabase
      .from('regles')
      .insert([{ user_id: user.id, date: dateStr }])
    if (error) setDays(d => d.filter(x => x !== dateStr))
    return { error }
  }

  const removeDay = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    const prev = days
    setDays(d => d.filter(x => x !== dateStr))
    const { error } = await supabase
      .from('regles')
      .delete()
      .eq('user_id', user.id)
      .eq('date', dateStr)
    if (error) setDays(prev)
    return { error }
  }

  const removeDays = async (dateArr) => {
    if (!user) return { error: 'Non connecté' }
    const set = new Set(dateArr.map(fmt))
    const prev = days
    setDays(d => d.filter(x => !set.has(x)))
    const { error } = await supabase
      .from('regles')
      .delete()
      .eq('user_id', user.id)
      .in('date', [...set])
    if (error) setDays(prev)
    return { error }
  }

  const toggleDay = (date) => {
    const dateStr = fmt(date)
    return days.includes(dateStr) ? removeDay(dateStr) : addDay(dateStr)
  }

  // Import en lot (Palier 6) : n'insère que les jours pas déjà présents,
  // en une seule requête. Renvoie le nombre effectivement ajouté.
  const addManyDays = async (dateArr) => {
    if (!user) return { error: 'Non connecté', added: 0 }
    const clean = sortDedupe(dateArr.map(fmt)).filter(d => !days.includes(d))
    if (!clean.length) return { error: null, added: 0 }
    setDays(d => sortDedupe([...d, ...clean]))
    const { error } = await supabase
      .from('regles')
      .insert(clean.map(d => ({ user_id: user.id, date: d })))
    if (error) setDays(d => d.filter(x => !clean.includes(x)))
    return { error, added: error ? 0 : clean.length }
  }

  const blocks = useMemo(() => periodBlocks(days), [days])
  const starts = useMemo(() => periodStarts(days), [days])

  return { days, blocks, starts, loading, addDay, removeDay, removeDays, addManyDays, toggleDay, refetch: load }
}
