import { useCallback, useMemo, useState } from 'react'
import { useRecipes } from './useRecipes'
import { useMealTemplatesList } from './useMealTemplates'
import { useFavorites } from './useFavorites'
import { useSettings } from './useSettings'
import { computeMealTargets } from '../lib/nutrients'
import { getCurrentSeason } from '../lib/seasons'
import { buildMealPlan, defaultMealConfig } from '../lib/mealPlanner'

// ─────────────────────────────────────────────────────────────────────────────
// useMealPlanner — branche les données (recettes, repas types, favoris,
// réglages) sur le solveur pur `buildMealPlan` (src/lib/mealPlanner.js), et
// tient l'état de configuration + le plan généré.
//
// PALIER 1 : configuration + génération + aperçu. L'écriture dans
// `repas_planifies` et l'ajout à la liste de courses viendront brancher
// `applyToCalendar` / `addToShoppingList` une fois l'aperçu validé.
//
// Voir docs/planificateur-repas.md.
// ─────────────────────────────────────────────────────────────────────────────
export function useMealPlanner() {
  const { recettes, loading: loadingRecipes } = useRecipes()
  const { repasTypes, loading: loadingTemplates } = useMealTemplatesList()
  const { favorites, loading: loadingFav } = useFavorites()
  const { settings, loading: loadingSettings } = useSettings()

  const dataLoading = loadingRecipes || loadingTemplates || loadingFav || loadingSettings

  const mealTargets = useMemo(() => computeMealTargets(settings), [settings])

  // ── Configuration ────────────────────────────────────────────────────────
  const [config, setConfigState] = useState(() => ({
    days: 7,
    people: 1,
    season: getCurrentSeason(),
    seasonMode: 'bonus', // 'bonus' | 'filter'
    mealConfig: null,     // rempli au premier rendu utile (voir effectiveConfig)
  }))

  // mealConfig par défaut dès que les cibles par repas sont connues (repas
  // actifs), sauf si l'utilisatrice l'a déjà personnalisé.
  const effectiveMealConfig = useMemo(() => {
    if (config.mealConfig) return config.mealConfig
    return defaultMealConfig(mealTargets)
  }, [config.mealConfig, mealTargets])

  const setConfig = useCallback((patch) => {
    setConfigState(c => ({ ...c, ...patch }))
  }, [])

  const setMealConfig = useCallback((updater) => {
    setConfigState(c => ({
      ...c,
      mealConfig: typeof updater === 'function'
        ? updater(c.mealConfig || defaultMealConfig(mealTargets))
        : updater,
    }))
  }, [mealTargets])

  // ── Plan généré ─────────────────────────────────────────────────────────
  const [plan, setPlan] = useState(null)
  const [generating, setGenerating] = useState(false)

  const runGenerate = useCallback((seed) => {
    setGenerating(true)
    try {
      const result = buildMealPlan({
        days: config.days,
        people: config.people,
        season: config.season,
        mealConfig: config.mealConfig || defaultMealConfig(mealTargets),
        recettes,
        repasTypes,
        favorites,
        mealTargets,
        goalFibres: settings?.goal_fibres || 0,
        options: { seasonMode: config.seasonMode, seed },
      })
      setPlan(result)
      return result
    } finally {
      setGenerating(false)
    }
  }, [config, mealTargets, recettes, repasTypes, favorites, settings?.goal_fibres])

  // Première génération : seed aléatoire.
  const generate = useCallback(() => runGenerate((Math.random() * 2 ** 31) >>> 0), [runGenerate])
  // Régénérer : nouveau seed → nouveau tirage.
  const regenerate = generate

  const reset = useCallback(() => setPlan(null), [])

  return {
    // données
    dataLoading,
    recipeCount: recettes.length,
    templateCount: repasTypes.length,
    favoriteCount: favorites.length,
    mealTargets,
    // config
    config,
    mealConfig: effectiveMealConfig,
    setConfig,
    setMealConfig,
    // plan
    plan,
    generating,
    generate,
    regenerate,
    reset,
  }
}
