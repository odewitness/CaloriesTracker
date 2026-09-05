import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { foodIdentity } from './useFavorites'

const HISTORY_LIMIT = 30

// Historique des anciennes quantités loguées pour CET aliment précis (même
// notion d'identité que foodIdentity/scaleFood : food_source + food_ref_id,
// ou food_name en repli si pas de référence stable — ex. Open Food Facts).
// Sert de repère dans FoodPicker (étape configure) : si un jour la balance
// n'est pas sous la main, on peut se recaler sur les grammages précédents.
// Limité aux 30 dernières entrées, tous jours/repas confondus.
export function useFoodHistory(food) {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const { source, refId, name, key } = food ? foodIdentity(food) : {}

  useEffect(() => {
    if (!user?.id || !food) { setHistory([]); return }
    let cancelled = false
    setLoading(true)
    let query = supabase
      .from('journal')
      .select('id, date, qty_g')
      .eq('user_id', user.id)
      .eq('food_source', source)
    query = refId != null ? query.eq('food_ref_id', refId) : query.is('food_ref_id', null).eq('food_name', name)
    query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error) setHistory(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, key])

  return { history, loading }
}
