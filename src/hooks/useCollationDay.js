import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useCollationDay — surcharge « par jour » de l'activation de la Collation.
// `override` : true / false = état forcé pour ce jour ; null = aucune surcharge,
// on suit le défaut global settings.meal_enabled.Collation (voir TodayPage /
// computeMealTargets). Toggle = upsert dans collation_jours, aucun journal
// touché (voir supabase/sql/collation_jours_setup.sql).
// ─────────────────────────────────────────────────────────────────────────────
export function useCollationDay(date) {
  const { user } = useAuth()
  const [override, setOverrideState] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchOverride = useCallback(async () => {
    if (!date || !user?.id) { setOverrideState(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('collation_jours')
      .select('active')
      .eq('date', date)
      .eq('user_id', user.id)
      .maybeSingle()
    setOverrideState(data ? data.active : null)
    setLoading(false)
  }, [date, user?.id])

  useEffect(() => { fetchOverride() }, [fetchOverride])

  const setOverride = async (active) => {
    if (!user || !date) return
    setOverrideState(active)
    await supabase
      .from('collation_jours')
      .upsert(
        { user_id: user.id, date, active, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' },
      )
  }

  return { override, loading, setOverride }
}
