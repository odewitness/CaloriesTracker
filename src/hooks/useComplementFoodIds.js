import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { COMPLEMENT_CATEGORY } from '../lib/foodCategories'

// ─────────────────────────────────────────────────────────────────────────────
// useComplementFoodIds — Set des id d'aliments_custom rangés dans la catégorie
// « Compléments alimentaires ». Sert à écarter les compléments des suggestions
// « À combler aujourd'hui » (voir TodayGapsSection) : le favori garde un
// snapshot figé de `food_data` (voir FoodPicker), donc sa `categorie` peut
// être périmée si le complément a été recatégorisé après coup — on recoupe
// donc avec la source de vérité.
// ─────────────────────────────────────────────────────────────────────────────
export function useComplementFoodIds() {
  const { user } = useAuth()
  const [ids, setIds] = useState(() => new Set())

  const load = useCallback(async () => {
    if (!user?.id) { setIds(new Set()); return }
    const { data } = await supabase
      .from('aliments_custom')
      .select('id')
      .eq('user_id', user.id)
      .eq('categorie', COMPLEMENT_CATEGORY)
    setIds(new Set((data || []).map(r => r.id)))
  }, [user?.id])

  useEffect(() => { load() }, [load])

  return ids
}
