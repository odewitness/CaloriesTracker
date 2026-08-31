import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useRecipes } from './useRecipes'
import { useMealTemplatesList } from './useMealTemplates'
import { useFavorites } from './useFavorites'
import { useSettings } from './useSettings'
import { computeMealTargets } from '../lib/nutrients'
import { todayStr } from '../lib/dates'
import { getCurrentSeason } from '../lib/seasons'
import { buildMealPlan, defaultMealConfig } from '../lib/mealPlanner'
import { planToPlannedRows, addDaysStr } from '../lib/mealPlannerApply'

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
  const { user } = useAuth()
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
    startDateStr: todayStr(),
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

  // ── Plan généré ─────────────────────────────────────────────────────────
  const [plan, setPlan] = useState(null)
  const [generating, setGenerating] = useState(false)
  // Repas verrouillés : Set de `${dayIndex}|${meal}`. Repris tels quels à la
  // régénération. Vidé dès que la config change (les index de jour / repas
  // pourraient ne plus correspondre).
  const [lockedKeys, setLockedKeys] = useState(() => new Set())

  const setConfig = useCallback((patch) => {
    setConfigState(c => ({ ...c, ...patch }))
    setLockedKeys(new Set())
  }, [])

  const setMealConfig = useCallback((updater) => {
    setConfigState(c => ({
      ...c,
      mealConfig: typeof updater === 'function'
        ? updater(c.mealConfig || defaultMealConfig(mealTargets))
        : updater,
    }))
    setLockedKeys(new Set())
  }, [mealTargets])

  const toggleLock = useCallback((dayIndex, meal) => {
    setLockedKeys(s => {
      const n = new Set(s)
      const k = `${dayIndex}|${meal}`
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })
  }, [])

  const toggleLockDay = useCallback((dayIndex, meals) => {
    setLockedKeys(s => {
      const n = new Set(s)
      const keys = meals.map(m => `${dayIndex}|${m}`)
      const allLocked = keys.every(k => n.has(k))
      keys.forEach(k => (allLocked ? n.delete(k) : n.add(k)))
      return n
    })
  }, [])

  const runGenerate = useCallback((seed) => {
    setGenerating(true)
    try {
      // Repas figés depuis le plan courant, pour les clés verrouillées.
      const locked = {}
      if (plan) {
        for (const key of lockedKeys) {
          const [dStr, meal] = key.split('|')
          const dayMeal = plan.days[Number(dStr)]?.meals.find(m => m.meal === meal)
          if (dayMeal) locked[key] = dayMeal
        }
      }
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
        locked,
      })
      setPlan(result)
      return result
    } finally {
      setGenerating(false)
    }
  }, [config, mealTargets, recettes, repasTypes, favorites, settings?.goal_fibres, plan, lockedKeys])

  // Première génération : seed aléatoire.
  const generate = useCallback(() => runGenerate((Math.random() * 2 ** 31) >>> 0), [runGenerate])
  // Régénérer : nouveau seed → nouveau tirage (garde les repas verrouillés).
  const regenerate = generate

  const reset = useCallback(() => { setPlan(null); setLockedKeys(new Set()) }, [])

  // ── Appliquer au calendrier ─────────────────────────────────────────────
  // Charge les données manquantes (ingrédients des recettes du plan, jours
  // exclus, repas déjà planifiés sur la plage), construit les lignes via
  // planToPlannedRows, puis insère en une fois avec un recurrence_group_id
  // commun (→ « Mes programmations » sait supprimer tout le plan d'un coup).
  //
  // conflictStrategy : 'skip' (défaut) ne planifie pas un créneau
  // date+repas déjà occupé ; 'add' insère quand même à côté. On ne supprime
  // et on n'écrase jamais rien.
  const applyToCalendar = useCallback(async ({ startDateStr, conflictStrategy = 'skip' }) => {
    if (!plan || !user?.id) return { error: 'no-plan' }

    const recetteIds = new Set()
    for (const day of plan.days) {
      for (const m of day.meals) {
        for (const it of m.items) if (it.kind === 'recette') recetteIds.add(it.id)
      }
    }
    const lastDateStr = addDaysStr(startDateStr, plan.days.length - 1)

    const [{ data: ingRows }, { data: exclRows }, { data: existRows }] = await Promise.all([
      recetteIds.size
        ? supabase.from('recette_ingredients').select('*').in('recette_id', [...recetteIds]).eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      supabase.from('jours_exclus').select('date').eq('user_id', user.id).gte('date', startDateStr).lte('date', lastDateStr),
      supabase.from('repas_planifies').select('date, meal').eq('user_id', user.id).gte('date', startDateStr).lte('date', lastDateStr),
    ])

    const ingredientsByRecetteId = {}
    for (const r of ingRows || []) {
      (ingredientsByRecetteId[r.recette_id] = ingredientsByRecetteId[r.recette_id] || []).push(r)
    }
    const excludedDates = new Set((exclRows || []).map(r => r.date))
    const occupied = new Set((existRows || []).map(r => `${r.date}|${r.meal}`))

    const recettesById = Object.fromEntries(recettes.map(r => [r.id, r]))
    const templatesById = Object.fromEntries(repasTypes.map(t => [t.id, t]))

    const { rows, skippedExcluded } = planToPlannedRows(plan, {
      startDateStr, recettesById, ingredientsByRecetteId, templatesById, excludedDates,
    })

    const skippedConflict = []
    const finalRows = conflictStrategy === 'skip'
      ? rows.filter(r => {
        if (occupied.has(`${r.date}|${r.meal}`)) { skippedConflict.push(r); return false }
        return true
      })
      : rows

    if (!finalRows.length) {
      return { inserted: 0, rows: [], skippedExcluded, skippedConflict, error: null }
    }

    const groupId = crypto.randomUUID()
    const payload = finalRows.map(r => ({ ...r, user_id: user.id, recurrence_group_id: groupId }))
    const { error } = await supabase.from('repas_planifies').insert(payload)
    if (error) return { error }
    // `rows` = lignes insérées, items d'ingrédients déjà développés → prêtes
    // pour addPlannedItems (liste de courses).
    return { inserted: finalRows.length, rows: finalRows, skippedExcluded, skippedConflict, groupId, error: null }
  }, [plan, user?.id, recettes, repasTypes])

  // Retire d'un coup toutes les lignes d'un plan appliqué (même
  // recurrence_group_id).
  const removePlan = useCallback(async (groupId) => {
    if (!groupId || !user?.id) return { error: 'no-group' }
    const { error } = await supabase
      .from('repas_planifies')
      .delete()
      .eq('recurrence_group_id', groupId)
      .eq('user_id', user.id)
    return { error }
  }, [user?.id])

  return {
    // données
    dataLoading,
    recettes,
    repasTypes,
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
    lockedKeys,
    toggleLock,
    toggleLockDay,
    applyToCalendar,
    removePlan,
  }
}
