// ─────────────────────────────────────────────────────────────────────────────
// mealPlanner — solveur PUR (aucune dépendance React / Supabase) du chantier
// « Planificateur automatique de repas de la semaine ».
// Voir docs/planificateur-repas.md (cadrage, décisions, paliers).
//
// PALIER 1 : macros seulement (kcal / protéines / glucides / lipides + fibres
// en cible molle), portions = celles renseignées dans la recette (pas de
// scaling libre du grammage), aliments « en + » piochés dans les favoris.
//
// Entrée principale : buildMealPlan(params) → { days, weekTotals, weekScore,
// picks }. Le module ne parle qu'en objets simples : les hooks branchent les
// données (useRecipes, useMealTemplates, useFavorites, computeMealTargets) et
// l'UI consomme le plan.
// ─────────────────────────────────────────────────────────────────────────────

import { RECIPE_CATEGORIES } from './recipeCategories'
import { filterBySeasons } from './seasons'
import { getPortion, rawValue } from './ciqualExplorer'

// Macros suivies par le solveur. `key` = clé dans l'objet macros interne,
// `target` = clé correspondante dans computeMealTargets() (null = pas de cible
// par repas → traité en cible molle au niveau jour / semaine).
export const PLAN_MACROS = [
  { key: 'kcal', label: 'Calories', targetKey: 'kcal', weight: 1.0 },
  { key: 'prot', label: 'Protéines', targetKey: 'prot', weight: 1.6 },
  { key: 'gluc', label: 'Glucides', targetKey: 'gluc', weight: 0.7 },
  { key: 'lip', label: 'Lipides', targetKey: 'lip', weight: 0.8 },
  { key: 'fibres', label: 'Fibres', targetKey: null, weight: 0.5 },
]

// Poids relatif d'un slot dans son repas, par catégorie de recette — sert
// uniquement à répartir la cible du repas entre ses briques pour NOTER les
// candidats (un dessert vise ~1/4 des calories d'un plat, etc.). Normalisé par
// repas dans splitMealTarget(). Valeur par défaut 0.5 pour toute catégorie non
// listée.
export const SLOT_WEIGHT_BY_CATEGORY = {
  'Petit-déjeuner': 1.0,
  'Collation': 1.0,
  'Plat': 1.0,
  'Accompagnement': 0.4,
  'Boisson': 0.15,
  'Dessert': 0.3,
  'Pain / pâtes': 0.35,
}

// Seuil de résidu calorique d'un repas en deçà duquel on ne cherche pas
// d'aliment « en + » (les recettes suffisent).
const MIN_RESIDUAL_KCAL = 60
// Nombre max d'aliments « en + » ajoutés à un repas.
const MAX_ADDONS_PER_MEAL = 2
// Plafond de grammage d'un aliment « en + » (repris de ciqualExplorer).
const MAX_ADDON_G = 200
// Itérations de recherche locale.
const LOCAL_SEARCH_ROUNDS = 60

// ── RNG déterministe (mulberry32) ───────────────────────────────────────────
// Un même `seed` reproduit le même plan → le bouton « régénérer » change juste
// de seed, et « verrouiller + régénérer » garde les parties verrouillées avec
// un nouveau seed pour le reste.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted(items, weightOf, rng) {
  const weights = items.map(weightOf)
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)] || null
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

// ── Profil macro d'une portion ─────────────────────────────────────────────

const EMPTY_MACROS = { kcal: 0, prot: 0, gluc: 0, lip: 0, fibres: 0 }

function addMacros(a, b) {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    gluc: a.gluc + b.gluc,
    lip: a.lip + b.lip,
    fibres: a.fibres + b.fibres,
  }
}

// Poids d'UNE portion d'une recette : poids cuit si renseigné, sinon poids cru,
// divisé par le nombre de portions. 0 → recette non dimensionnable (exclue du
// vivier, voir buildVivier).
function recipePortionWeightG(recette) {
  const ref = recette.poids_cuit_g || recette.poids_cru_g || 0
  const parts = recette.portions || 1
  if (ref > 0 && parts > 0) return ref / parts
  return 0
}

// Macros d'UNE portion de recette (valeurs /100 g × poids de portion).
export function recipePortionMacros(recette) {
  const g = recipePortionWeightG(recette)
  if (g <= 0) return null
  const f = g / 100
  return {
    kcal: (recette.energie_kcal || 0) * f,
    prot: (recette.proteines || 0) * f,
    gluc: (recette.glucides || 0) * f,
    lip: (recette.lipides || 0) * f,
    fibres: (recette.fibres || 0) * f,
    _portionG: g,
  }
}

// Macros d'UNE part de repas type : somme des items (déjà en valeurs absolues)
// divisée par nb_portions.
export function templateServingMacros(repasType) {
  const items = repasType.items || []
  if (!items.length) return null
  const parts = repasType.nb_portions || 1
  const sum = items.reduce((acc, it) => addMacros(acc, {
    kcal: it.energie_kcal || 0,
    prot: it.proteines || 0,
    gluc: it.glucides || 0,
    lip: it.lipides || 0,
    fibres: it.fibres || 0,
  }), { ...EMPTY_MACROS })
  const f = parts > 0 ? 1 / parts : 1
  return {
    kcal: sum.kcal * f, prot: sum.prot * f, gluc: sum.gluc * f,
    lip: sum.lip * f, fibres: sum.fibres * f,
  }
}

// ── Cibles ─────────────────────────────────────────────────────────────────

// Cible d'un repas, complétée en fibres (computeMealTargets ne donne pas les
// fibres) au prorata de la part calorique du repas dans la journée.
function mealTargetWithFibres(mealTargets, meal, goalFibres) {
  const t = mealTargets?.[meal] || { kcal: 0, prot: 0, gluc: 0, lip: 0 }
  const totalKcal = Object.values(mealTargets || {}).reduce((s, m) => s + (m?.kcal || 0), 0) || 1
  const fibShare = goalFibres > 0 ? goalFibres * ((t.kcal || 0) / totalKcal) : 0
  return { kcal: t.kcal || 0, prot: t.prot || 0, gluc: t.gluc || 0, lip: t.lip || 0, fibres: fibShare }
}

// Répartit la cible d'un repas entre ses slots, au prorata des poids de
// catégorie (SLOT_WEIGHT_BY_CATEGORY) normalisés. Sert à noter les candidats
// d'un slot ; l'évaluation finale se fait sur le repas entier.
function splitMealTarget(mealTarget, slots) {
  const weights = slots.map(s => s.type === 'repas_type' ? 1 : (SLOT_WEIGHT_BY_CATEGORY[s.categorie] ?? 0.5))
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  return slots.map((_, i) => {
    const w = weights[i] / sum
    return {
      kcal: mealTarget.kcal * w, prot: mealTarget.prot * w,
      gluc: mealTarget.gluc * w, lip: mealTarget.lip * w, fibres: mealTarget.fibres * w,
    }
  })
}

// ── Score ──────────────────────────────────────────────────────────────────

// Distance pondérée d'un total macro à sa cible : Σ w·|total−cible|/cible.
// Les fibres et toute cible ≤ 0 sont ignorées pour cette échelle.
export function macroDistance(total, target) {
  let d = 0
  for (const m of PLAN_MACROS) {
    const cible = target[m.key]
    if (!cible || cible <= 0) continue
    d += m.weight * Math.abs((total[m.key] || 0) - cible) / cible
  }
  return d
}

// Niveau d'écart pour le feu tricolore, sur une macro donnée.
//   'ok'   écart relatif < 8 %
//   'warn' écart relatif < 18 %
//   'off'  au-delà
export function deviationLevel(value, target) {
  if (!target || target <= 0) return 'ok'
  const rel = Math.abs(value - target) / target
  if (rel < 0.08) return 'ok'
  if (rel < 0.18) return 'warn'
  return 'off'
}

// ── Vivier ─────────────────────────────────────────────────────────────────

function matchesSeason(entity, season, mode) {
  if (!season || mode !== 'filter') return true
  return filterBySeasons([entity], [season]).length > 0
}

function seasonBonus(entity, season) {
  if (!season) return 0
  return (entity.saisons || []).includes(season) ? 0.15 : 0
}

// Candidats d'un slot : recettes de la bonne catégorie (ou repas types), avec
// des valeurs nutritionnelles exploitables et une portion dimensionnable.
function buildVivier(slot, { recettes, repasTypes, season, seasonMode }) {
  if (slot.type === 'repas_type') {
    return (repasTypes || [])
      .filter(rt => matchesSeason(rt, season, seasonMode))
      .map(rt => ({ kind: 'repas_type', id: rt.id, nom: rt.nom, entity: rt, macros: templateServingMacros(rt) }))
      .filter(c => c.macros && c.macros.kcal > 0)
  }
  return (recettes || [])
    .filter(r => (r.categories || []).includes(slot.categorie))
    .filter(r => (r.energie_kcal || 0) > 0)
    .filter(r => recipePortionWeightG(r) > 0)
    .filter(r => matchesSeason(r, season, seasonMode))
    .map(r => ({ kind: 'recette', id: r.id, nom: r.nom, entity: r, macros: recipePortionMacros(r) }))
    .filter(c => c.macros)
}

// ── Aliments « en + » (favoris) ────────────────────────────────────────────

// Lignes de `favoris` → objets « aliment » exploitables par rawValue /
// getPortion / scaleFood. On écarte les recettes mises en favori (source
// 'recette' : pas un ingrédient à mettre en liste de courses), et on garantit
// un `alim_nom` non vide (sinon scaleFood produirait un item sans nom →
// insertion `journal` / `liste_courses_items` en échec).
export function favoriteFoods(favorites) {
  return (favorites || [])
    .filter(f => f && f.food_source !== 'recette')
    .map(f => {
      const d = f.food_data || {}
      return { ...d, alim_nom: d.alim_nom || d.food_name || f.food_name || d.nom || null }
    })
    .filter(d => d.alim_nom && (d.energie_kcal || 0) > 0)
}

// Comble le résidu macro d'un repas avec 0 à MAX_ADDONS_PER_MEAL favoris.
// Heuristique : à chaque tour, on vise la macro dont le déficit RELATIF est le
// plus fort (protéines pondérées plus haut via PLAN_MACROS), on prend le
// favori le plus dense sur cette macro, et on le dimensionne pour combler ce
// déficit sans dépasser le résidu calorique ni MAX_ADDON_G.
//
// `excludeKeys` : foodKey des favoris déjà utilisés ailleurs dans la journée —
// évités en priorité (repli sur la liste complète si ça ne laisse rien).
function fillWithAddons(residual, target, foods, rng, excludeKeys = new Set()) {
  const addons = []
  let res = { ...residual }
  const used = new Set()
  const preferFoods = excludeKeys.size
    ? foods.filter(f => !excludeKeys.has(foodKey(f)))
    : foods
  const pool = preferFoods.length ? preferFoods : foods

  for (let step = 0; step < MAX_ADDONS_PER_MEAL; step++) {
    if (res.kcal < MIN_RESIDUAL_KCAL) break

    // Macro motrice = plus gros déficit relatif parmi celles avec une cible.
    let driver = null
    let driverScore = 0
    for (const m of PLAN_MACROS) {
      if (m.key === 'kcal') continue
      const cible = target[m.key]
      if (!cible || cible <= 0 || res[m.key] <= 0) continue
      const s = m.weight * (res[m.key] / cible)
      if (s > driverScore) { driverScore = s; driver = m.key }
    }
    if (!driver) driver = 'kcal'

    const field = FIELD_BY_MACRO[driver]
    const ranked = pool
      .filter(f => !used.has(foodKey(f)))
      .map(f => ({ f, per100: driver === 'kcal' ? (f.energie_kcal || 0) : (rawValue(f, field) || 0) }))
      .filter(x => x.per100 > 0)
      .sort((a, b) => b.per100 - a.per100)
    if (!ranked.length) break

    // Un peu de variété : on pioche parmi les 4 plus denses.
    const pick = pickWeighted(ranked.slice(0, 4), x => x.per100, rng)
    const food = pick.f
    const kcalPer100 = food.energie_kcal || 0
    if (kcalPer100 <= 0) { used.add(foodKey(food)); continue }

    // Grammage : min(ce qu'il faut pour la macro motrice, ce qui tient dans le
    // résidu kcal, plafond réaliste, portion habituelle × 2).
    const gForDriver = driver === 'kcal'
      ? (res.kcal / kcalPer100) * 100
      : (res[driver] / pick.per100) * 100
    const gForKcal = (res.kcal / kcalPer100) * 100
    const gPortionCap = getPortion(food).g * 2
    let g = Math.min(gForDriver, gForKcal, MAX_ADDON_G, gPortionCap)
    g = Math.round(g / 5) * 5
    if (g < 5) { used.add(foodKey(food)); continue }

    const f = g / 100
    const macros = {
      kcal: kcalPer100 * f,
      prot: (rawValue(food, 'proteines') ?? food.proteines ?? 0) * f,
      gluc: (rawValue(food, 'glucides') ?? food.glucides ?? 0) * f,
      lip: (rawValue(food, 'lipides') ?? food.lipides ?? 0) * f,
      fibres: (rawValue(food, 'fibres') ?? food.fibres ?? 0) * f,
    }
    addons.push({ kind: 'ajout', food, nom: food.alim_nom || food.food_name, qty_g: g, macros })
    used.add(foodKey(food))
    res = {
      kcal: res.kcal - macros.kcal,
      prot: res.prot - macros.prot,
      gluc: res.gluc - macros.gluc,
      lip: res.lip - macros.lip,
      fibres: res.fibres - macros.fibres,
    }
  }
  return addons
}

const FIELD_BY_MACRO = { prot: 'proteines', gluc: 'glucides', lip: 'lipides', fibres: 'fibres', kcal: 'energie_kcal' }

function foodKey(f) {
  return `${f._source || f.food_source || 'ciqual'}:${f.alim_code || f.id || f.food_ref_id || f.alim_nom || f.food_name}`
}

// ── Construction du plan ───────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {number} p.days            1..7
 * @param {number} [p.people=1]      nombre de personnes (liste de courses)
 * @param {string|null} [p.season]   'Printemps'|'Été'|'Automne'|'Hiver'|null
 * @param {object} p.mealConfig      { [meal]: [{ type:'recette', categorie, nbDifferentes } | { type:'repas_type', nbDifferentes }] }
 * @param {Array}  p.recettes        useRecipes().recettes
 * @param {Array}  p.repasTypes      liste des repas_types
 * @param {Array}  p.favorites       useFavorites().favorites
 * @param {object} p.mealTargets     computeMealTargets(settings)
 * @param {number} [p.goalFibres=0]  settings.goal_fibres
 * @param {object} [p.options]       { seasonMode:'bonus'|'filter', seed:number }
 * @returns {{ days:Array, weekTotals:object, weekScore:number, picks:object, warnings:Array }}
 */
export function buildMealPlan(p) {
  const {
    days, people = 1, season = null, mealConfig, recettes = [], repasTypes = [],
    favorites = [], mealTargets = {}, goalFibres = 0, options = {},
  } = p
  const seasonMode = options.seasonMode === 'filter' ? 'filter' : 'bonus'
  const rng = makeRng(options.seed || 1)
  const warnings = []
  const foods = favoriteFoods(favorites)

  const meals = Object.keys(mealConfig || {})

  // Vivier de chaque slot, calculé une fois et réutilisé (tirage, affectation,
  // recherche locale).
  const viviers = {} // { [meal]: [ [candidate, ...] par slot ] }
  for (const meal of meals) {
    viviers[meal] = (mealConfig[meal] || []).map(
      slot => buildVivier(slot, { recettes, repasTypes, season, seasonMode }),
    )
  }

  // 1. Tirage des N recettes distinctes par slot, sur toute la période.
  const picks = {} // { [meal]: [ [candidate, ...] par slot ] }
  for (const meal of meals) {
    const slots = mealConfig[meal] || []
    const target = mealTargetWithFibres(mealTargets, meal, goalFibres)
    const slotTargets = splitMealTarget(target, slots)
    picks[meal] = slots.map((slot, si) => {
      const viv = viviers[meal][si]
      if (!viv.length) {
        warnings.push(`Aucune ${slot.type === 'repas_type' ? 'recette / repas type' : `recette « ${slot.categorie} »`} disponible pour ${meal}.`)
        return []
      }
      const st = slotTargets[si]
      const scored = viv
        .map(c => ({ c, dist: macroDistance(c.macros, st) - seasonBonus(c.entity, season) }))
        .sort((a, b) => a.dist - b.dist)
      const n = Math.max(1, Math.min(slot.nbDifferentes || 1, scored.length))
      const chosen = []
      const poolSize = Math.min(scored.length, Math.max(n + 3, Math.ceil(scored.length * 0.5)))
      const pool = scored.slice(0, poolSize).map(x => x.c)
      const forced = (slot.pinnedIds || [])
        .map(id => viv.find(c => c.id === id))
        .filter(Boolean)
      for (const fc of forced) { if (chosen.length < n) chosen.push(fc) }
      while (chosen.length < n && pool.length) {
        const cand = pickWeighted(
          pool.filter(c => !chosen.some(x => x.id === c.id)),
          c => 1 / (1 + (scored.find(s => s.c.id === c.id)?.dist ?? 1)),
          rng,
        )
        if (!cand) break
        chosen.push(cand)
      }
      return chosen
    })
  }

  // 2. Affectation aux jours + aliments « en + » → structure du plan.
  const build = () => {
    const dayList = []
    for (let d = 0; d < days; d++) {
      const dayMeals = []
      // Aucune brique (recette / repas type) ni aucun aliment « en + » ne doit
      // réapparaître dans un autre repas du MÊME jour — sinon on voit le même
      // plat midi et soir. Suivi sur toute la journée, tous repas confondus.
      const usedRecipeIds = new Set()
      const usedAddonKeys = new Set()
      for (const meal of meals) {
        const slots = mealConfig[meal] || []
        const target = mealTargetWithFibres(mealTargets, meal, goalFibres)
        const items = []
        slots.forEach((slot, si) => {
          const slotPicks = picks[meal][si]
          if (!slotPicks.length) return
          // rotation décalée par slot pour ne pas aligner toutes les briques
          let cand = slotPicks[(d + si) % slotPicks.length]
          if (usedRecipeIds.has(cand.id)) {
            // collision dans la journée : on prend d'abord un autre tirage du
            // slot, puis n'importe quel candidat du vivier, non encore utilisé
            // aujourd'hui. En dernier recours seulement, on garde la collision.
            const alt = slotPicks.find(c => !usedRecipeIds.has(c.id))
              || (viviers[meal][si] || []).find(c => !usedRecipeIds.has(c.id))
            if (alt) cand = alt
          }
          usedRecipeIds.add(cand.id)
          items.push({
            kind: cand.kind, id: cand.id, nom: cand.nom,
            portions: 1,
            portionG: cand.macros._portionG || null,
            macros: { ...cand.macros },
          })
        })
        const recipeTotals = items.reduce((acc, it) => addMacros(acc, it.macros), { ...EMPTY_MACROS })
        const residual = {
          kcal: target.kcal - recipeTotals.kcal,
          prot: target.prot - recipeTotals.prot,
          gluc: target.gluc - recipeTotals.gluc,
          lip: target.lip - recipeTotals.lip,
          fibres: target.fibres - recipeTotals.fibres,
        }
        const addons = fillWithAddons(residual, target, foods, rng, usedAddonKeys)
        for (const a of addons) usedAddonKeys.add(foodKey(a.food))
        const allItems = [...items, ...addons]
        const totals = allItems.reduce((acc, it) => addMacros(acc, it.macros), { ...EMPTY_MACROS })
        dayMeals.push({
          meal, target, items: allItems, totals,
          score: macroDistance(totals, target) + (totals.kcal > target.kcal * 1.12 ? 0.5 : 0),
        })
      }
      const dayTarget = meals.reduce((acc, m) => addMacros(acc, mealTargetWithFibres(mealTargets, m, goalFibres)), { ...EMPTY_MACROS })
      const dayTotals = dayMeals.reduce((acc, m) => addMacros(acc, m.totals), { ...EMPTY_MACROS })
      // pénalité répétition : même recette deux jours de suite
      let repeatPenalty = 0
      if (d > 0) {
        const prev = new Set(dayList[d - 1].meals.flatMap(m => m.items.filter(i => i.kind !== 'ajout').map(i => i.id)))
        const cur = dayMeals.flatMap(m => m.items.filter(i => i.kind !== 'ajout').map(i => i.id))
        repeatPenalty = 0.25 * cur.filter(id => prev.has(id)).length
      }
      dayList.push({
        dayIndex: d, meals: dayMeals, target: dayTarget, totals: dayTotals,
        score: dayMeals.reduce((s, m) => s + m.score, 0) + repeatPenalty,
      })
    }
    return dayList
  }

  let dayList = build()
  let bestScore = dayList.reduce((s, d) => s + d.score, 0)

  // 3. Recherche locale : on tente de remplacer une recette tirée par une
  //    autre du vivier du même slot ; on garde si le score total baisse.
  for (let round = 0; round < LOCAL_SEARCH_ROUNDS; round++) {
    const meal = meals[Math.floor(rng() * meals.length)]
    const slots = mealConfig[meal] || []
    if (!slots.length) continue
    const si = Math.floor(rng() * slots.length)
    const slotPicks = picks[meal][si]
    if (slotPicks.length < 1) continue
    const viv = viviers[meal][si] || []
    const alt = viv.find(c => !slotPicks.some(x => x.id === c.id))
    if (!alt) continue
    const replaceIdx = Math.floor(rng() * slotPicks.length)
    const prev = slotPicks[replaceIdx]
    slotPicks[replaceIdx] = alt
    const trial = build()
    const trialScore = trial.reduce((s, d) => s + d.score, 0)
    if (trialScore < bestScore - 1e-6) {
      dayList = trial
      bestScore = trialScore
    } else {
      slotPicks[replaceIdx] = prev
    }
  }

  const weekTargets = dayList.reduce((acc, d) => addMacros(acc, d.target), { ...EMPTY_MACROS })
  const weekTotals = dayList.reduce((acc, d) => addMacros(acc, d.totals), { ...EMPTY_MACROS })

  return {
    days: dayList,
    weekTarget: weekTargets,
    weekTotals,
    weekScore: bestScore,
    people,
    picks: Object.fromEntries(
      meals.map(m => [m, picks[m].map(slotPicks => slotPicks.map(c => ({ id: c.id, nom: c.nom, kind: c.kind })))]),
    ),
    warnings,
  }
}

// Récapitulatif « batch cooking » : pour chaque recette / repas type du plan,
// combien de portions il consomme sur la période et combien de fournées cela
// représente (une fournée = recette.portions, ou repasType.nb_portions).
// Répond à la question « je prépare quoi, en quelle quantité » sans avoir à
// mettre une recette à l'échelle : on cuisine N fournées entières.
export function batchSummary(plan, { recettesById = {}, templatesById = {} } = {}) {
  const map = new Map()
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const it of meal.items) {
        if (it.kind !== 'recette' && it.kind !== 'repas_type') continue
        const cur = map.get(it.id) || { id: it.id, nom: it.nom, kind: it.kind, portionsNeeded: 0 }
        cur.portionsNeeded += it.portions || 1
        map.set(it.id, cur)
      }
    }
  }
  return [...map.values()]
    .map(e => {
      const perBatch = e.kind === 'recette'
        ? (recettesById[e.id]?.portions || 1)
        : (templatesById[e.id]?.nb_portions || 1)
      const batches = Math.max(1, Math.ceil(e.portionsNeeded / perBatch))
      return { ...e, perBatch, batches, leftover: batches * perBatch - e.portionsNeeded }
    })
    .sort((a, b) => b.portionsNeeded - a.portionsNeeded)
}

// Config de repas par défaut : une brique par repas actif, catégorie déduite
// du nom du repas. À présenter pré-remplie dans l'écran de configuration.
export function defaultMealConfig(mealTargets) {
  const map = {
    'Petit-déjeuner': 'Petit-déjeuner',
    'Déjeuner': 'Plat',
    'Dîner': 'Plat',
    'Collation': 'Collation',
  }
  const cfg = {}
  for (const [meal, cat] of Object.entries(map)) {
    if (mealTargets?.[meal]?.enabled === false) continue
    cfg[meal] = [{ type: 'recette', categorie: RECIPE_CATEGORIES.includes(cat) ? cat : 'Plat', nbDifferentes: 2 }]
  }
  return cfg
}
