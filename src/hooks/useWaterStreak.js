import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { WATER_MEAL } from '../lib/water'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// useWaterStreak — nombre de jours CONSÉCUTIFS, en remontant depuis HIER, où le
// total d'eau bu a atteint l'objectif (`goal_ml`).
//
// On s'arrête volontairement à hier : WaterSection ajoute « +1 » en direct si
// l'objectif est atteint aujourd'hui, calculé depuis les entrées du jour
// qu'elle a déjà en main. Comme ça, la série se met à jour à la gorgée près
// sans re-requête à chaque ajout.
// ─────────────────────────────────────────────────────────────────────────────
const LOOKBACK_DAYS = 90

export function useWaterStreak(goalMl) {
  const { user } = useAuth()
  const [streakBeforeToday, setStreakBeforeToday] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id || !goalMl || goalMl <= 0) { setStreakBeforeToday(0); setLoading(false); return }
    setLoading(true)

    const since = new Date()
    since.setDate(since.getDate() - LOOKBACK_DAYS)
    const { data, error } = await supabase
      .from('journal')
      .select('date, qty_g')
      .eq('user_id', user.id)
      .eq('meal', WATER_MEAL)
      .gte('date', fmt(since))
    if (error) { setLoading(false); return }

    const mlByDate = {}
    for (const r of data || []) mlByDate[r.date] = (mlByDate[r.date] || 0) + (Number(r.qty_g) || 0)

    // Remonte jour par jour depuis hier tant que l'objectif est atteint.
    let streak = 0
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - 1)
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      if ((mlByDate[fmt(d)] || 0) >= goalMl) {
        streak++
        d.setDate(d.getDate() - 1)
      } else {
        break
      }
    }

    setStreakBeforeToday(streak)
    setLoading(false)
  }, [user?.id, goalMl])

  useEffect(() => { load() }, [load])

  return { streakBeforeToday, loading, refetch: load }
}
