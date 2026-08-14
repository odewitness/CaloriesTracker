import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useMeasurements — historique des relevés de poids/mensurations, un relevé
// par jour max (upsert sur (user_id, date), comme useSettings le fait sur
// user_id).
// ─────────────────────────────────────────────────────────────────────────────
export function useMeasurements() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setEntries([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('mensurations')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const save = async (entry) => {
    if (!user) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('mensurations')
      .upsert({ ...entry, user_id: user.id }, { onConflict: 'user_id,date' })
      .select()
      .single()
    if (!error && data) {
      setEntries(es => {
        const others = es.filter(e => e.date !== data.date)
        return [...others, data].sort((a, b) => b.date.localeCompare(a.date))
      })
    }
    return { data, error }
  }

  const deleteEntry = async (id) => {
    if (!user) return { error: 'Non connecté' }
    const { error } = await supabase
      .from('mensurations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) setEntries(es => es.filter(e => e.id !== id))
    return { error }
  }

  return { entries, loading, save, deleteEntry, refetch: load }
}
