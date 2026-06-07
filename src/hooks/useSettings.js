import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULTS = { goal_kcal: 1800, goal_proteines: 100, goal_glucides: 180, goal_lipides: 60, goal_fibres: 30 }

export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setSettings({ ...DEFAULTS, ...data }) })
      .finally(() => setLoading(false))
  }, [])

  const update = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await supabase.from('settings').upsert({ id: 1, ...next, updated_at: new Date().toISOString() })
  }

  return { settings, loading, update }
}
