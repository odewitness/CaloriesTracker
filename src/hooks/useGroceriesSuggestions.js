import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const HISTORY_LIMIT = 300
const SUGGESTIONS_LIMIT = 6

// ─────────────────────────────────────────────────────────────────────────────
// useGroceriesSuggestions — les aliments les plus fréquents dans l'historique
// des suggestions "À combler aujourd'hui" (voir suggestions_manques, alimentée
// par TodayGapsSection.jsx via logSuggestions), utilisés pour proposer une
// section "Suggestions" dans la liste de courses (voir ShoppingListPage.jsx).
//
// Même pattern d'agrégation côté client que useMealSuggestions : on prend un
// historique borné, on compte les occurrences par identité d'aliment, on
// classe par fréquence. Les nutriments visés sont regroupés par aliment (un
// même aliment peut avoir été suggéré pour plusieurs manques différents).
// ─────────────────────────────────────────────────────────────────────────────
export function useGroceriesSuggestions() {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) { setSuggestions([]); setLoading(false); return }
    setLoading(true)

    const { data } = await supabase
      .from('suggestions_manques')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    const counts = new Map() // key -> { count, food_source, food_ref_id, food_name, nutrientKeys: Set }
    for (const row of (data || [])) {
      const key = `${row.food_source}:${row.food_ref_id ?? row.food_name}`
      const current = counts.get(key)
      if (current) {
        current.count += 1
        current.nutrientKeys.add(row.nutrient_key)
      } else {
        counts.set(key, {
          count: 1,
          food_source: row.food_source,
          food_ref_id: row.food_ref_id,
          food_name: row.food_name,
          nutrientKeys: new Set([row.nutrient_key]),
        })
      }
    }

    const ranked = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, SUGGESTIONS_LIMIT)
      .map(s => ({ ...s, nutrientKeys: [...s.nutrientKeys] }))
    setSuggestions(ranked)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return { suggestions, loading, refetch: load }
}
