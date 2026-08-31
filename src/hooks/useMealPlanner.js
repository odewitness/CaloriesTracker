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
import {
  buildMealPlan, defaultMealConfig, vivierForGroupKey, recomputePlanAggregates,
  recipePortionMacros, templateServingMacros,
} from '../lib/mealPlanner'
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
export function useMealPlanner({ defaultStartDate } = {}) {
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
    startDateStr: defaultStartDate || todayStr(),
    season: getCurrentSeason(),
    seasonMode: 'bonus', // 'bonus' | 'filter'
    mealConfig: null,     // rempli au premier rendu utile (voir effectiveConfig)
    excludedMeals: [],    // repas exclus de CE plan (sans toucher meal_enabled global)
  }))

  // mealConfig par défaut dès que les cibles par repas sont connues (repas
  // actifs), sauf si l'utilisatrice l'a déjà personnalisé. Les repas exclus de
  // ce plan (config.excludedMeals) sont retirés.
  const effectiveMealConfig = useMemo(() => {
    const base = config.mealConfig || defaultMealConfig(mealTargets)
    const excluded = new Set(config.excludedMeals || [])
    return Object.fromEntries(Object.entries(base).filter(([meal]) => !excluded.has(meal)))
  }, [config.mealConfig, config.excludedMeals, mealTargets])

  // Config complète (repas exclus INCLUS) pour l'écran de configuration —
  // chaque repas y a une case « inclure ».
  const baseMealConfig = useMemo(
    () => config.mealConfig || defaultMealConfig(mealTargets),
    [config.mealConfig, mealTargets],
  )

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

  // Exclure / réinclure un repas de CE plan (n'affecte pas meal_enabled).
  const toggleMeal = useCallback((meal) => {
    setConfigState(c => {
      const ex = new Set(c.excludedMeals || [])
      ex.has(meal) ? ex.delete(meal) : ex.add(meal)
      return { ...c, excludedMeals: [...ex] }
    })
    setLockedKeys(new Set())
  }, [])

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
        mealConfig: effectiveMealConfig,
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
  }, [config, effectiveMealConfig, mealTargets, recettes, repasTypes, favorites, settings?.goal_fibres, plan, lockedKeys])

  // Première génération : seed aléatoire.
  const generate = useCallback(() => runGenerate((Math.random() * 2 ** 31) >>> 0), [runGenerate])
  // Régénérer : nouveau seed → nouveau tirage (garde les repas verrouillés).
  const regenerate = generate

  const reset = useCallback(() => { setPlan(null); setLockedKeys(new Set()) }, [])

  // ── Édition manuelle d'une brique dans l'aperçu ─────────────────────────
  // Toute édition manuelle VERROUILLE le repas concerné (sinon la régénération
  // suivante l'écraserait sans prévenir).
  const findMealIdx = (p, dayIndex, meal) =>
    p?.days[dayIndex]?.meals.findIndex(m => m.meal === meal) ?? -1

  const applyItemsEdit = useCallback((dayIndex, meal, mapItems) => {
    setPlan(p => {
      if (!p) return p
      const mi = findMealIdx(p, dayIndex, meal)
      if (mi < 0) return p
      const days = p.days.map((d, di) => di !== dayIndex ? d : {
        ...d,
        meals: d.meals.map((m, j) => j !== mi ? m : { ...m, items: mapItems(m.items) }),
      })
      return recomputePlanAggregates({ ...p, days })
    })
    setLockedKeys(s => new Set(s).add(`${dayIndex}|${meal}`))
  }, [])

  // Recettes / repas types de remplacement possibles pour une brique donnée
  // (même groupe : catégorie, ou « Plat ou repas type »), hors brique courante
  // et hors briques déjà utilisées ce jour-là.
  const swapCandidates = useCallback((dayIndex, meal, itemIndex) => {
    const mi = findMealIdx(plan, dayIndex, meal)
    if (mi < 0) return []
    const day = plan.days[dayIndex]
    const it = day.meals[mi].items[itemIndex]
    if (!it || (it.kind !== 'recette' && it.kind !== 'repas_type')) return []
    const usedToday = new Set(
      day.meals.flatMap(m => m.items.filter(x => x.kind !== 'ajout').map(x => x.id)),
    )
    const key = it.groupKey || (it.kind === 'repas_type' ? 'repas_type' : `recette:${it.categorie}`)
    return vivierForGroupKey(key, {
      recettes, repasTypes, season: config.season, seasonMode: config.seasonMode,
    })
      .filter(c => c.id !== it.id && !usedToday.has(c.id))
      .map(c => ({ id: c.id, nom: c.nom, kind: c.kind }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [plan, recettes, repasTypes, config.season, config.seasonMode])

  const swapItem = useCallback((dayIndex, meal, itemIndex, candidateId) => {
    const rec = recettes.find(r => r.id === candidateId)
    const tpl = repasTypes.find(t => t.id === candidateId)
    const macros = rec ? recipePortionMacros(rec) : tpl ? templateServingMacros(tpl) : null
    if (!macros) return
    applyItemsEdit(dayIndex, meal, items => items.map((x, i) => i !== itemIndex ? x : {
      ...x,
      kind: rec ? 'recette' : 'repas_type',
      id: candidateId,
      nom: rec ? rec.nom : tpl.nom,
      categorie: rec ? (x.categorie || rec.categories?.[0] || null) : null,
      portions: 1,
      portionG: macros._portionG || null,
      macros: { ...macros },
    }))
  }, [recettes, repasTypes])

  const removeItem = useCallback((dayIndex, meal, itemIndex) => {
    applyItemsEdit(dayIndex, meal, items => items.filter((_, i) => i !== itemIndex))
  }, [])

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
    baseMealConfig,
    excludedMeals: config.excludedMeals || [],
    setConfig,
    setMealConfig,
    toggleMeal,
    // plan
    plan,
    generating,
    generate,
    regenerate,
    reset,
    lockedKeys,
    toggleLock,
    toggleLockDay,
    swapCandidates,
    swapItem,
    removeItem,
    applyToCalendar,
    removePlan,
  }
}
