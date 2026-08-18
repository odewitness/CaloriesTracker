import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { entryToFood } from '../lib/journalEntry'

export function useRecentFoods() {
  const { user } = useAuth()
  const [recents, setRecents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) { setRecents([]); setLoading(false); return }
    setLoading(true)

    // Plus de filtre par date : on prend simplement les 100 dernières entrées
    // du journal, tous jours confondus, puis on déduplique par aliment.
    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    // Déduplication par identité d'aliment, on garde l'occurrence la plus récente.
    const seen = new Set()
    const unique = []
    for (const entry of (data || [])) {
      const key = `${entry.food_source}:${entry.food_ref_id ?? entry.food_name}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(entryToFood(entry))
    }
    setRecents(unique)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return { recents, loading, refetch: load }
}