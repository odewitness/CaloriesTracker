import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

import { MEAL_ENABLED_DEFAULTS } from '../lib/nutrients'
import { WATER_DEFAULTS, mergeWaterSettings } from '../lib/water'
import { CYCLE_DEFAULTS, mergeCycleSettings } from '../lib/cycle'
import { SPORT_DEFAULTS, mergeSportSettings } from '../lib/sport'
import { DEFAULT_TODAY_SECTIONS_ORDER, normalizeTodaySectionsOrder } from '../lib/todaySections'

const DEFAULTS = {
  goal_kcal: 1800, goal_proteines: 100, goal_glucides: 180, goal_lipides: 60, goal_fibres: 30,
  meal_overrides: {},
  meal_enabled: { ...MEAL_ENABLED_DEFAULTS },
  notif_reminder_enabled: true,
  notif_social_enabled: true,
  afficher_manques_jour: true,
  ordre_sections_jour: [...DEFAULT_TODAY_SECTIONS_ORDER],
  water: { ...WATER_DEFAULTS },
  cycle: { ...CYCLE_DEFAULTS },
  sport: { ...SPORT_DEFAULTS },
}

// Applique le même traitement que meal_enabled/meal_overrides aux blocs `water`,
// `cycle` et `sport` (fusion avec les valeurs par défaut), pour rester robuste
// si la colonne `settings.water` / `settings.cycle` / `settings.sport` est
// absente (base pas encore migrée) ou partielle.
function withWater(row) {
  return { ...DEFAULTS, ...row, meal_overrides: row?.meal_overrides || {}, meal_enabled: { ...MEAL_ENABLED_DEFAULTS, ...(row?.meal_enabled || {}) }, ordre_sections_jour: normalizeTodaySectionsOrder(row?.ordre_sections_jour), water: mergeWaterSettings(row?.water), cycle: mergeCycleSettings(row?.cycle), sport: mergeSportSettings(row?.sport) }
}

export function useSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  // Dernier état connu, tenu à jour de façon synchrone : `update()` construit le
  // prochain settings à partir de CETTE ref, pas de la valeur `settings` figée
  // dans sa closure. Sans ça, deux update() rapprochés (ex. régler l'eau puis
  // l'ordre des sections) partaient tous deux du même `settings` périmé et le
  // 2ᵉ écrasait le 1ᵉ en réécrivant l'objet entier.
  const settingsRef = useRef(settings)
  const setSettingsSynced = useCallback((next) => {
    settingsRef.current = next
    setSettings(next)
  }, [])

  // Sérialise les écritures Supabase : un upsert ne part qu'une fois le
  // précédent résolu, pour que l'ordre en base suive l'ordre des appels.
  const writeChain = useRef(Promise.resolve())

  const load = useCallback(async () => {
    if (!user) { setSettingsSynced(DEFAULTS); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      setSettingsSynced(withWater(data))
    } else {
      const { data: created } = await supabase
        .from('settings')
        .insert([{ ...DEFAULTS, user_id: user.id }])
        .select()
        .single()
      setSettingsSynced(withWater(created || {}))
    }
    setLoading(false)
  }, [user, setSettingsSynced])

  useEffect(() => { load() }, [load])

  const update = useCallback(async (patch) => {
    if (!user) return
    const next = { ...settingsRef.current, ...patch }
    setSettingsSynced(next)
    writeChain.current = writeChain.current
      .then(() => supabase
        .from('settings')
        .upsert({ ...next, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }))
      .then(({ error } = {}) => { if (error) console.error('useSettings.update error:', error) })
      .catch((e) => console.error('useSettings.update error:', e))
    return writeChain.current
  }, [user, setSettingsSynced])

  return { settings, loading, update }
}