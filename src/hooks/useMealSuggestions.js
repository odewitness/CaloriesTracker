import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { entryToFood } from '../lib/journalEntry'

const HISTORY_LIMIT = 300
const SUGGESTIONS_LIMIT = 4

// ─────────────────────────────────────────────────────────────────────────────
// useMealSuggestions — les aliments les plus fréquents historiquement pour un
// repas donné (ex: "Petit-déjeuner"), utilisés pour l'ajout ultra-rapide
// contextuel sur la page Aujourd'hui. Contrairement à useRecentFoods (les
// plus RÉCENTS, tous repas confondus), on classe ici par fréquence
// d'occurrence sur ce repas précis, en gardant la ligne la plus récente de
// chaque aliment pour la quantité par défaut proposée.
// ─────────────────────────────────────────────────────────────────────────────
export function useMealSuggestions(meal) {
  const { user } = useAuth()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id || !meal) { setSuggestions([]); setLoading(false); return }
    setLoading(true)

    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('user_id', user.id)
      .eq('meal', meal)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)

    const counts = new Map() // key -> { count, entry (occurrence la plus récente) }
    for (const entry of (data || [])) {
      const key = `${entry.food_source}:${entry.food_ref_id ?? entry.food_name}`
      const current = counts.get(key)
      if (current) current.count += 1
      else counts.set(key, { count: 1, entry })
    }

    const ranked = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, SUGGESTIONS_LIMIT)
      .map(({ entry }) => entryToFood(entry))
    setSuggestions(ranked)
    setLoading(false)
  }, [user?.id, meal])

  useEffect(() => { load() }, [load])

  return { suggestions, loading, refetch: load }
}
