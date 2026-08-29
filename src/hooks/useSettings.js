import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

import { MEAL_ENABLED_DEFAULTS } from '../lib/nutrients'
import { WATER_DEFAULTS, mergeWaterSettings } from '../lib/water'
import { CYCLE_DEFAULTS, mergeCycleSettings } from '../lib/cycle'

const DEFAULTS = {
  goal_kcal: 1800, goal_proteines: 100, goal_glucides: 180, goal_lipides: 60, goal_fibres: 30,
  meal_overrides: {},
  meal_enabled: { ...MEAL_ENABLED_DEFAULTS },
  notif_reminder_enabled: true,
  notif_social_enabled: true,
  afficher_manques_jour: true,
  water: { ...WATER_DEFAULTS },
  cycle: { ...CYCLE_DEFAULTS },
}

// Applique le même traitement que meal_enabled/meal_overrides aux blocs `water`
// et `cycle` (fusion avec les valeurs par défaut), pour rester robuste si la
// colonne `settings.water` / `settings.cycle` est absente (base pas encore
// migrée) ou partielle.
function withWater(row) {
  return { ...DEFAULTS, ...row, meal_overrides: row?.meal_overrides || {}, meal_enabled: { ...MEAL_ENABLED_DEFAULTS, ...(row?.meal_enabled || {}) }, water: mergeWaterSettings(row?.water), cycle: mergeCycleSettings(row?.cycle) }
}

export function useSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setSettings(DEFAULTS); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      setSettings(withWater(data))
    } else {
      const { data: created } = await supabase
        .from('settings')
        .insert([{ ...DEFAULTS, user_id: user.id }])
        .select()
        .single()
      setSettings(withWater(created || {}))
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const update = async (patch) => {
    if (!user) return
    const next = { ...settings, ...patch }
    setSettings(next)
    await supabase
      .from('settings')
      .upsert({ ...next, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  }

  return { settings, loading, update }
}