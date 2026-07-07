import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'

// Le journal stocke des valeurs déjà mises à l'échelle de qty_g (pas des
// valeurs /100g) — on doit donc "dé-proportionner" pour reconstruire un objet
// "food" réutilisable par AddFoodModal, dans le même format que les résultats
// de recherche (alim_nom, valeurs /100g, portions, _source...).
function entryToFood(entry) {
  const f = entry.qty_g > 0 ? 100 / entry.qty_g : 0
  const food = {
    alim_nom: entry.food_name,
    categorie: 'Récent',
    alim_code: entry.food_source === 'ciqual' ? entry.food_ref_id : undefined,
    id: entry.food_source !== 'ciqual' ? entry.food_ref_id : undefined,
    energie_kcal: parseFloat(((entry.energie_kcal || 0) * f).toFixed(1)),
    proteines: parseFloat(((entry.proteines || 0) * f).toFixed(2)),
    glucides: parseFloat(((entry.glucides || 0) * f).toFixed(2)),
    lipides: parseFloat(((entry.lipides || 0) * f).toFixed(2)),
    fibres: parseFloat(((entry.fibres || 0) * f).toFixed(2)),
    // Pas de portions connues en base → on propose la dernière quantité utilisée.
    portions: entry.qty_g ? [{ label: 'Dernière quantité', g: entry.qty_g }] : [],
    _source: entry.food_source,
  }
  for (const key of ALL_NUTRIENT_KEYS) {
    const raw = entry[key]
    food[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
  }
  return food
}

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