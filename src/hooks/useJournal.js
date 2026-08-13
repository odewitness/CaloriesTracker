import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { bumpFavoriteUsage } from './useFavorites'

export function useJournal(date) {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    if (!date || !user?.id) { setEntries([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('date', date)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }, [date, user?.id])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const addEntry = async (entry) => {
    if (!user) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('journal')
      .insert([{ ...entry, date, user_id: user.id }])
      .select()
      .single()
    if (!error && data) {
      setEntries(e => [...e, data])
      // Non bloquant : ne doit jamais retarder ni faire échouer l'ajout au journal.
      bumpFavoriteUsage(user.id, data)
    }
    return { data, error }
  }

  const deleteEntry = async (id) => {
    await supabase.from('journal').delete().eq('id', id).eq('user_id', user.id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const updateEntry = async (id, patch) => {
    const { data, error } = await supabase
      .from('journal')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (!error && data) setEntries(e => e.map(x => x.id === id ? data : x))
    return { data, error }
  }

  return { entries, loading, addEntry, deleteEntry, updateEntry, refetch: fetchEntries }
}