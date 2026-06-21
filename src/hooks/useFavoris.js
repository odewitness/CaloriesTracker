import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Une "identité" d'aliment = source + référence stable (alim_code Ciqual, id
// custom...) ; si pas de référence (cas Open Food Facts sans code), on retombe
// sur le nom — ce n'est pas parfait mais c'est déjà le comportement existant
// ailleurs dans l'app (food_ref_id peut être null pour les entrées 'off').
export function foodIdentity(food) {
  const source = food._source || food.food_source || 'ciqual'
  const refId = food.alim_code || food.id || food.food_ref_id || null
  const name = food.alim_nom || food.food_name
  return { source, refId, name, key: `${source}:${refId ?? name}` }
}

export function useFavoris() {
  const { user } = useAuth()
  const [favoris, setFavoris] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) { setFavoris([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('favoris')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setFavoris(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const favKeySet = new Set(favoris.map(f => `${f.food_source}:${f.food_ref_id ?? f.food_name}`))

  const isFavorite = useCallback((food) => favKeySet.has(foodIdentity(food).key), [favoris])

  // food = l'objet complet tel que manipulé par AddFoodModal (alim_nom, valeurs
  // pour 100g, portions, _source, alim_code/id...) — on le stocke tel quel.
  const toggleFavorite = async (food) => {
    if (!user?.id) return
    const { source, refId, name, key } = foodIdentity(food)
    const existing = favoris.find(f => `${f.food_source}:${f.food_ref_id ?? f.food_name}` === key)

    if (existing) {
      await supabase.from('favoris').delete().eq('id', existing.id).eq('user_id', user.id)
      setFavoris(f => f.filter(x => x.id !== existing.id))
    } else {
      const { data, error } = await supabase
        .from('favoris')
        .insert([{ user_id: user.id, food_source: source, food_ref_id: refId ? String(refId) : null, food_name: name, food_data: food }])
        .select()
        .single()
      if (!error && data) setFavoris(f => [data, ...f])
    }
  }

  return { favoris, loading, isFavorite, toggleFavorite }
}
