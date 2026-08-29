import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { sortedStarts } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// useCycle — historique des dates de 1er jour des règles (table `regles`),
// saisi à la main. Une ligne = un début de règles. Le calcul de phase se fait
// côté client à partir de la liste complète (voir src/lib/cycle.js), donc on
// charge tout : quelques dizaines de lignes par an, négligeable.
//
// toggleStart(date) : ajoute la date si absente, la retire si présente
// (insert/delete, jamais d'update — même esprit que useExcludedDay).
// ─────────────────────────────────────────────────────────────────────────────
export function useCycle() {
  const { user } = useAuth()
  const [dates, setDates] = useState([]) // ['YYYY-MM-DD', ...] triées croissant
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setDates([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('regles')
      .select('date_debut')
      .eq('user_id', user.id)
      .order('date_debut', { ascending: true })
    setDates((data || []).map(r => r.date_debut))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const addStart = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    setDates(d => sortedStarts([...d, dateStr]))
    const { error } = await supabase
      .from('regles')
      .insert([{ user_id: user.id, date_debut: dateStr }])
    if (error) setDates(d => d.filter(x => x !== dateStr))
    return { error }
  }

  const removeStart = async (date) => {
    if (!user) return { error: 'Non connecté' }
    const dateStr = fmt(date)
    const prev = dates
    setDates(d => d.filter(x => x !== dateStr))
    const { error } = await supabase
      .from('regles')
      .delete()
      .eq('user_id', user.id)
      .eq('date_debut', dateStr)
    if (error) setDates(prev)
    return { error }
  }

  const toggleStart = (date) => {
    const dateStr = fmt(date)
    return dates.includes(dateStr) ? removeStart(dateStr) : addStart(dateStr)
  }

  return { dates, loading, addStart, removeStart, toggleStart, refetch: load }
}
