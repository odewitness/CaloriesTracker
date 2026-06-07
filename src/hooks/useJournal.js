import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useJournal(date) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!date) return
    setLoading(true)
    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  const addEntry = async (entry) => {
    const { data, error } = await supabase.from('journal').insert([{ ...entry, date }]).select().single()
    if (!error && data) setEntries(e => [...e, data])
    return { data, error }
  }

  const deleteEntry = async (id) => {
    await supabase.from('journal').delete().eq('id', id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const updateEntry = async (id, patch) => {
    const { data, error } = await supabase.from('journal').update(patch).eq('id', id).select().single()
    if (!error && data) setEntries(e => e.map(x => x.id === id ? data : x))
    return { data, error }
  }

  return { entries, loading, addEntry, deleteEntry, updateEntry, refetch: fetch }
}
