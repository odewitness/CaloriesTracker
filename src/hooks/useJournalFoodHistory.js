import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useJournalFoodHistory — historique de consommation du journal (tous jours
// confondus), réduit aux seules infos d'identité d'aliment. Sert au réglage
// "Quels aliments proposer" de la section "À combler aujourd'hui" (voir
// TodayGapsSection) pour filtrer ses suggestions :
//   - recentKeys : identités vues dans les RECENT_WINDOW dernières entrées
//   - countByKey : nombre d'occurrences par identité sur COUNT_WINDOW entrées
//
// COUNT_WINDOW n'est pas illimité pour garder la requête légère : un aliment
// mangé une seule fois il y a très longtemps peut donc être compté comme
// "jamais consommé". Acceptable pour un usage perso.
//
// La clé d'identité est construite comme dans useRecentFoods /
// useFavorites.foodIdentity : `${source}:${refId ?? name}`.
// ─────────────────────────────────────────────────────────────────────────────
const RECENT_WINDOW = 50
const COUNT_WINDOW = 1000

function keyOf(entry) {
  return `${entry.food_source}:${entry.food_ref_id ?? entry.food_name}`
}

export function useJournalFoodHistory() {
  const { user } = useAuth()
  const [recentKeys, setRecentKeys] = useState(() => new Set())
  const [countByKey, setCountByKey] = useState(() => new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) {
      setRecentKeys(new Set())
      setCountByKey(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('journal')
      .select('food_source, food_ref_id, food_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(COUNT_WINDOW)

    const rows = data || []
    const recent = new Set()
    for (const entry of rows.slice(0, RECENT_WINDOW)) recent.add(keyOf(entry))
    const counts = new Map()
    for (const entry of rows) {
      const k = keyOf(entry)
      counts.set(k, (counts.get(k) || 0) + 1)
    }
    setRecentKeys(recent)
    setCountByKey(counts)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return { recentKeys, countByKey, loading, refetch: load }
}
