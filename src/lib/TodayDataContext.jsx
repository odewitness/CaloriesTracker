import React, { createContext, useContext } from 'react'
import { useCycle } from '../hooks/useCycle'
import { useMeasurements } from '../hooks/useMeasurements'
import { useProfile } from '../hooks/useProfile'
import { useFavorites } from '../hooks/useFavorites'
import { useSettings } from '../hooks/useSettings'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFeed } from '../hooks/useFeed'
import { useWaterStreak } from '../hooks/useWaterStreak'
import { useGoalAdjustment } from '../hooks/useGoalAdjustment'

// ─────────────────────────────────────────────────────────────────────────────
// TodayDataContext — regroupe les données de la page du jour qui NE dépendent
// PAS de la date affichée : profil, réglages, cycle, mensurations, favoris,
// catalogue Ciqual, partages (pour les fonctions de partage).
//
// Le slider de TodayPage rend 3 slots (hier / aujourd'hui / demain) en même
// temps. Chaque DaySlot appelait directement ces 7 hooks → 3 jeux de requêtes
// Supabase identiques, relancés à chaque swipe (un nouveau slot se monte).
// Ici on les monte UNE fois, au niveau de TodayPage, et les 3 DaySlots lisent
// la même instance via useTodayData().
//
// Les hooks DATÉS (useJournal, useSport, useExcludedDay, usePlannedMealsForDate)
// restent dans DaySlot : leurs données changent d'un slot à l'autre.
//
// Chaque entrée expose l'objet de retour COMPLET du hook (mêmes clés, mêmes
// fonctions) — les call-sites dans DaySlot destructurent exactement comme
// avant, seul l'endroit de l'appel change.
// ─────────────────────────────────────────────────────────────────────────────
const TodayDataContext = createContext(null)

export function TodayDataProvider({ children }) {
  const cycle = useCycle()
  const measurements = useMeasurements()
  const profile = useProfile()
  const favorites = useFavorites()
  const settings = useSettings()
  const ciqual = useCiqualCatalog()
  const feed = useFeed()
  const waterStreak = useWaterStreak(settings.settings?.water?.goal_ml)
  const goalAdjust = useGoalAdjustment({
    profile: profile.profile,
    measurementEntries: measurements.entries,
    settings: settings.settings,
    updateSettings: settings.update,
  })

  const value = { cycle, measurements, profile, favorites, settings, ciqual, feed, waterStreak, goalAdjust }

  return <TodayDataContext.Provider value={value}>{children}</TodayDataContext.Provider>
}

export function useTodayData() {
  const ctx = useContext(TodayDataContext)
  if (!ctx) throw new Error('useTodayData doit être utilisé dans <TodayDataProvider>')
  return ctx
}
