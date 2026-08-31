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

// Somme des macros d'une liste d'items { macros }.
export function sumItemMacros(items) {
  return (items || []).reduce((acc, it) => addMacros(acc, it.macros || EMPTY_MACROS), { ...EMPTY_MACROS })
}

// Recalcule totals + scores (repas / jour / semaine) d'un plan dont les items
// ont été édités à la main (swap / retrait de brique). Les cibles ne changent
// pas.
export function recomputePlanAggregates(plan) {
  const days = plan.days.map(day => {
    const meals = day.meals.map(m => {
      const totals = sumItemMacros(m.items)
      return { ...m, totals, score: macroDistance(totals, m.target) + (totals.kcal > m.target.kcal * 1.12 ? 0.5 : 0) }
    })
    const totals = meals.reduce((acc, m) => addMacros(acc, m.totals), { ...EMPTY_MACROS })
    return { ...day, meals, totals, score: meals.reduce((s, m) => s + m.score, 0) }
  })
  const weekTotals = days.reduce((acc, d) => addMacros(acc, d.totals), { ...EMPTY_MACROS })
  return { ...plan, days, weekTotals, weekScore: days.reduce((s, d) => s + d.score, 0) }
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

// Clé de regroupement d'un slot : les slots de même clé partagent UN vivier et
// UN pool de recettes tirées sur la période (ex. « Plat » au déjeuner et au
// dîner = les mêmes N recettes qui tournent, pas N + N).
//   'repas_type'        → un repas type entier
//   'mixte:<categorie>' → recette de cette catégorie OU repas type
//   'recette:<categorie>'
export function slotGroupKey(slot) {
  if (slot.type === 'repas_type') return 'repas_type'
  if (slot.type === 'mixte') return `mixte:${slot.categorie}`
  return `recette:${slot.categorie}`
}

function repasTypeCandidates(repasTypes, season, seasonMode, categorie = null) {
  return (repasTypes || [])
    .filter(rt => !categorie || (rt.categories || []).includes(categorie))
    .filter(rt => matchesSeason(rt, season, seasonMode))
    .map(rt => ({ kind: 'repas_type', id: rt.id, nom: rt.nom, entity: rt, macros: templateServingMacros(rt) }))
    .filter(c => c.macros && c.macros.kcal > 0)
}

function recetteCandidates(recettes, categorie, season, seasonMode) {
  return (recettes || [])
    .filter(r => (r.categories || []).includes(categorie))
    .filter(r => (r.energie_kcal || 0) > 0)
    .filter(r => recipePortionWeightG(r) > 0)
    .filter(r => matchesSeason(r, season, seasonMode))
    .map(r => ({ kind: 'recette', id: r.id, nom: r.nom, entity: r, macros: recipePortionMacros(r) }))
    .filter(c => c.macros)
}

// Candidats d'un slot, avec des valeurs nutritionnelles exploitables et une
// portion dimensionnable. Exporté : réutilisé par useMealPlanner pour proposer
// un remplacement de brique dans l'aperçu.
export function buildVivier(slot, { recettes, repasTypes, season, seasonMode }) {
  // 'repas_type' = n'importe quel repas type entier (pas de catégorie imposée).
  if (slot.type === 'repas_type') return repasTypeCandidates(repasTypes, season, seasonMode)
  const recs = recetteCandidates(recettes, slot.categorie, season, seasonMode)
  // 'mixte' = recette de la catégorie OU repas type DE LA MÊME catégorie.
  if (slot.type === 'mixte') {
    return [...recs, ...repasTypeCandidates(repasTypes, season, seasonMode, slot.categorie)]
  }
  return recs
}

// Vivier reconstruit depuis une clé de groupe (voir slotGroupKey) — pour le
// remplacement de brique dans l'aperçu, qui ne connaît que la clé.
export function vivierForGroupKey(key, ctx) {
  if (key === 'repas_type') return buildVivier({ type: 'repas_type' }, ctx)
  if (key.startsWith('mixte:')) return buildVivier({ type: 'mixte', categorie: key.slice(6) }, ctx)
  if (key.startsWith('recette:')) return buildVivier({ type: 'recette', categorie: key.slice(8) }, ctx)
  return []
}

function describeGroup(slot) {
  if (slot.type === 'repas_type') return 'un repas type'
  if (slot.type === 'mixte') return `« ${slot.categorie} » ou repas type`
  return `« ${slot.categorie} »`
}

function averageTargets(list) {
  const n = list.length || 1
  const acc = { ...EMPTY_MACROS }
  for (const t of list) for (const k of Object.keys(acc)) acc[k] += (t[k] || 0)
  for (const k of Object.keys(acc)) acc[k] /= n
  return acc
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
 * @param {object} [p.locked]        { `${dayIndex}|${meal}`: <objet repas figé de l'aperçu> }
 *                                   — repas verrouillés, repris tels quels à la régénération.
 * @returns {{ days:Array, weekTotals:object, weekScore:number, picks:object, warnings:Array }}
 */
export function buildMealPlan(p) {
  const {
    days, people = 1, season = null, mealConfig, recettes = [], repasTypes = [],
    favorites = [], mealTargets = {}, goalFibres = 0, options = {}, locked = {},
  } = p
  const seasonMode = options.seasonMode === 'filter' ? 'filter' : 'bonus'
  const rng = makeRng(options.seed || 1)
  const warnings = []
  const foods = favoriteFoods(favorites)

  const meals = Object.keys(mealConfig || {})

  // Slots regroupés par clé (voir slotGroupKey) : ceux de même clé — « Plat »
  // au déjeuner et au dîner par ex. — partagent UN vivier et UN pool de
  // recettes tirées sur la période (pas N + N).
  const groupSlots = {} // key -> [{ meal, si, slot, target }]
  for (const meal of meals) {
    const slots = mealConfig[meal] || []
    const slotTargets = splitMealTarget(mealTargetWithFibres(mealTargets, meal, goalFibres), slots)
    slots.forEach((slot, si) => {
      const key = slotGroupKey(slot)
      ;(groupSlots[key] = groupSlots[key] || []).push({ meal, si, slot, target: slotTargets[si] })
    })
  }

  // 1. Vivier + pool de recettes tirées, par groupe.
  const viviers = {} // key -> [candidate,...]
  const picks = {}   // key -> [candidate,...] (pool partagé par les slots du groupe)
  for (const [key, entries] of Object.entries(groupSlots)) {
    const refSlot = entries[0].slot
    const viv = buildVivier(refSlot, { recettes, repasTypes, season, seasonMode })
    viviers[key] = viv
    if (!viv.length) {
      warnings.push(`Aucune recette disponible pour ${describeGroup(refSlot)}.`)
      picks[key] = []
      continue
    }
    const avgTarget = averageTargets(entries.map(e => e.target))
    const scored = viv
      .map(c => ({ c, dist: macroDistance(c.macros, avgTarget) - seasonBonus(c.entity, season) }))
      .sort((a, b) => a.dist - b.dist)
    const nWanted = Math.max(...entries.map(e => e.slot.nbDifferentes || 1))
    const n = Math.max(1, Math.min(nWanted, scored.length))
    const chosen = []
    for (const id of new Set(entries.flatMap(e => e.slot.pinnedIds || []))) {
      const fc = viv.find(c => c.id === id)
      if (fc && chosen.length < n && !chosen.some(x => x.id === fc.id)) chosen.push(fc)
    }
    const poolSize = Math.min(scored.length, Math.max(n + 3, Math.ceil(scored.length * 0.5)))
    const cpool = scored.slice(0, poolSize).map(x => x.c)
    while (chosen.length < n && cpool.length) {
      const cand = pickWeighted(
        cpool.filter(c => !chosen.some(x => x.id === c.id)),
        c => 1 / (1 + (scored.find(s => s.c.id === c.id)?.dist ?? 1)),
        rng,
      )
      if (!cand) break
      chosen.push(cand)
    }
    picks[key] = chosen
  }

  // 2. Affectation aux jours + aliments « en + » → structure du plan.
  const build = () => {
    const dayList = []
    // Curseur de rotation par groupe, sur toute la période : le pool [A, B] du
    // groupe « Plat » donne A, B, A, B… en enchaînant déjeuner puis dîner puis
    // jour suivant — donc midi ≠ soir dès que le pool a 2 entrées.
    const groupCursor = {}
    for (let d = 0; d < days; d++) {
      const dayMeals = []
      // Aucune brique (recette / repas type) ni aucun aliment « en + » ne doit
      // réapparaître dans un autre repas du MÊME jour — sinon on voit le même
      // plat midi et soir. Suivi sur toute la journée, tous repas confondus.
      const usedRecipeIds = new Set()
      const usedAddonKeys = new Set()
      for (const meal of meals) {
        // Repas verrouillé : repris tel quel, et ses briques / aliments « en + »
        // comptent quand même dans l'anti-répétition de la journée.
        const frozen = locked[`${d}|${meal}`]
        if (frozen) {
          dayMeals.push(frozen)
          for (const it of frozen.items) {
            if (it.kind === 'ajout') { if (it.food) usedAddonKeys.add(foodKey(it.food)) }
            else usedRecipeIds.add(it.id)
          }
          continue
        }
        const slots = mealConfig[meal] || []
        const target = mealTargetWithFibres(mealTargets, meal, goalFibres)
        const items = []
        slots.forEach((slot) => {
          const key = slotGroupKey(slot)
          const pool = picks[key]
          if (!pool || !pool.length) return
          const cur = groupCursor[key] || 0
          groupCursor[key] = cur + 1
          // + d : décale d'un cran chaque jour → midi/soir permutent d'un jour
          // à l'autre au lieu de rester figés (midi=A, soir=B tous les jours).
          let cand = pool[(cur + d) % pool.length]
          if (usedRecipeIds.has(cand.id)) {
            // collision dans la journée : autre entrée du pool, sinon n'importe
            // quel candidat du vivier non encore utilisé aujourd'hui. En dernier
            // recours seulement, on garde la collision.
            const alt = pool.find(c => !usedRecipeIds.has(c.id))
              || (viviers[key] || []).find(c => !usedRecipeIds.has(c.id))
            if (alt) cand = alt
          }
          usedRecipeIds.add(cand.id)
          items.push({
            kind: cand.kind, id: cand.id, nom: cand.nom,
            groupKey: key,
            categorie: cand.kind === 'repas_type' ? null : (slot.categorie || null),
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

  // 3. Recherche locale : on tente de remplacer une recette d'un pool de groupe
  //    par une autre de son vivier ; on garde si le score total baisse.
  const swappableKeys = Object.keys(picks).filter(k => picks[k].length && (viviers[k] || []).length > picks[k].length)
  for (let round = 0; round < LOCAL_SEARCH_ROUNDS && swappableKeys.length; round++) {
    const key = swappableKeys[Math.floor(rng() * swappableKeys.length)]
    const pool = picks[key]
    const alt = (viviers[key] || []).find(c => !pool.some(x => x.id === c.id))
    if (!alt) continue
    const replaceIdx = Math.floor(rng() * pool.length)
    const prev = pool[replaceIdx]
    pool[replaceIdx] = alt
    const trial = build()
    const trialScore = trial.reduce((s, d) => s + d.score, 0)
    if (trialScore < bestScore - 1e-6) {
      dayList = trial
      bestScore = trialScore
    } else {
      pool[replaceIdx] = prev
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
      Object.entries(picks).map(([k, v]) => [k, v.map(c => ({ id: c.id, nom: c.nom, kind: c.kind }))]),
    ),
    warnings,
  }
}

// Récapitulatif « À préparer » : pour chaque recette / repas type du plan,
// combien de portions le plan consomme EXACTEMENT sur la période — c'est le
// « bon nombre », pas de reste. `baseYield` = portions d'origine de la recette
// (recette.portions / repasType.nb_portions) ; `factor` = de combien multiplier
// les ingrédients pour tomber pile sur `portionsNeeded` (1 = tel quel, 2 = deux
// fois la recette, 1,25 = une fois et quart…).
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
      const baseYield = e.kind === 'recette'
        ? (recettesById[e.id]?.portions || 1)
        : (templatesById[e.id]?.nb_portions || 1)
      const factor = baseYield > 0 ? e.portionsNeeded / baseYield : 1
      return { ...e, baseYield, factor }
    })
    .sort((a, b) => b.portionsNeeded - a.portionsNeeded)
}

// Config de repas par défaut : une brique par repas actif. Déjeuner et dîner
// tirent dans « Plat » OU les repas types (type 'mixte') ; petit-déj et
// collation dans leur catégorie de recette.
export function defaultMealConfig(mealTargets) {
  const map = {
    'Petit-déjeuner': { type: 'recette', categorie: 'Petit-déjeuner', nbDifferentes: 2 },
    'Déjeuner': { type: 'mixte', categorie: 'Plat', nbDifferentes: 2 },
    'Dîner': { type: 'mixte', categorie: 'Plat', nbDifferentes: 2 },
    'Collation': { type: 'recette', categorie: 'Collation', nbDifferentes: 1 },
  }
  const cfg = {}
  for (const [meal, slot] of Object.entries(map)) {
    if (mealTargets?.[meal]?.enabled === false) continue
    cfg[meal] = [{ ...slot }]
  }
  return cfg
}
