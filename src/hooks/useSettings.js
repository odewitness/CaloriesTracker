import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

import { MEAL_ENABLED_DEFAULTS } from '../lib/nutrients'

const DEFAULTS = {
  goal_kcal: 1800, goal_proteines: 100, goal_glucides: 180, goal_lipides: 60, goal_fibres: 30,
  meal_overrides: {},
  meal_enabled: { ...MEAL_ENABLED_DEFAULTS },
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
      setSettings({ ...DEFAULTS, ...data, meal_overrides: data.meal_overrides || {}, meal_enabled: { ...MEAL_ENABLED_DEFAULTS, ...(data.meal_enabled || {}) } })
    } else {
      const { data: created } = await supabase
        .from('settings')
        .insert([{ ...DEFAULTS, user_id: user.id }])
        .select()
        .single()
      setSettings({ ...DEFAULTS, ...(created || {}), meal_overrides: created?.meal_overrides || {}, meal_enabled: { ...MEAL_ENABLED_DEFAULTS, ...(created?.meal_enabled || {}) } })
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