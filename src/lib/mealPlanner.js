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
import {
  getPortion, rawValue, getNutrientGaps, getGapAmount, gapCoverage, CLAIM_MICRO_FIELDS,
} from './ciqualExplorer'

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
// Itérations de recherche locale (passes aléatoires, après le balayage glouton).
const LOCAL_SEARCH_ROUNDS = 90
// Balayage glouton : nb max d'alternatives (les mieux notées) essayées par
// position de pool avant les passes aléatoires.
const SWEEP_MAX_ALTS = 6

// ── Dépassement des cibles ─────────────────────────────────────────────────
// Le solveur ne sait qu'AJOUTER des aliments « en + », jamais retirer : si les
// recettes seules dépassent déjà la cible, rien ne corrige. Pour éviter les
// plans qui débordent, on pénalise le dépassement PLUS FORT que le déficit
// (asymétrie), surtout sur les calories. Appliqué au niveau jour + semaine.
const OVERSHOOT_KCAL_WEIGHT = 1.5
const OVERSHOOT_MACRO_WEIGHT = 0.6

function overshootPenalty(total, target) {
  let p = 0
  if (target.kcal > 0 && total.kcal > target.kcal) {
    p += OVERSHOOT_KCAL_WEIGHT * (total.kcal - target.kcal) / target.kcal
  }
  for (const k of ['prot', 'gluc', 'lip']) {
    if (target[k] > 0 && total[k] > target[k]) {
      p += OVERSHOOT_MACRO_WEIGHT * (total[k] - target[k]) / target[k]
    }
  }
  return p
}

// ── Portions doublées (PALIER 2) ───────────────────────────────────────────
// Le solveur peut poser 1 OU 2 portions (jamais fractionnaire, jamais plus)
// d'une brique quand un repas reste loin sous sa cible et qu'une brique
// éligible s'en rapproche en doublant.
const MAX_MEAL_PORTIONS = 2
// Catégories dont une brique peut être doublée (pas un Accompagnement / Dessert
// / Boisson : doubler la garniture ou le dessert n'a pas de sens).
const DOUBLE_ELIGIBLE_CATEGORIES = new Set(['Plat', 'Petit-déjeuner', 'Collation'])
// On ne double pas si le repas dépasse alors ce multiple de sa cible kcal.
const DOUBLE_KCAL_CEILING = 1.10
// Poids de la pénalité « portions gâchées » (recherche locale, niveau semaine) :
// privilégie les plans où le nombre total de portions d'une recette tombe sur un
// multiple propre de son rendement (moins de restes / de facteurs bâtards).
const LEFTOVER_PORTION_WEIGHT = 0.12

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

// Multiplie un profil macro par un scalaire (ex. 2 portions d'une brique).
// Exporté : le hook s'en sert pour le réglage manuel 1 / 2 portions dans l'aperçu.
export function scaleMacros(m, k) {
  return {
    kcal: (m.kcal || 0) * k,
    prot: (m.prot || 0) * k,
    gluc: (m.gluc || 0) * k,
    lip: (m.lip || 0) * k,
    fibres: (m.fibres || 0) * k,
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

// Clé de regroupement d'un slot = sa catégorie : les slots de même catégorie
// (« Plat » au déjeuner et au dîner) partagent UN vivier et UN pool de recettes
// tirées sur la période (pas N + N).
export function slotGroupKey(slot) {
  return slot.categorie
}

function repasTypeCandidates(repasTypes, categorie, season, seasonMode) {
  return (repasTypes || [])
    .filter(rt => (rt.categories || []).includes(categorie))
    .filter(rt => matchesSeason(rt, season, seasonMode))
    .map(rt => ({ kind: 'repas_type', id: rt.id, nom: rt.nom, entity: rt, macros: templateServingMacros(rt) }))
    .filter(c => c.macros && c.macros.kcal > 0)
}

// Temps de cuisine d'une recette = préparation + cuisson (le repos est passif,
// exclu). null / 0 des deux côtés → temps inconnu, la recette passe le filtre.
export function recipeCookMinutes(recette) {
  return (recette.temps_preparation_min || 0) + (recette.temps_cuisson_min || 0)
}

function recetteCandidates(recettes, categorie, season, seasonMode, maxCookMinutes) {
  return (recettes || [])
    .filter(r => (r.categories || []).includes(categorie))
    .filter(r => (r.energie_kcal || 0) > 0)
    .filter(r => recipePortionWeightG(r) > 0)
    .filter(r => matchesSeason(r, season, seasonMode))
    .filter(r => {
      if (!maxCookMinutes) return true
      const t = recipeCookMinutes(r)
      return t === 0 || t <= maxCookMinutes
    })
    .map(r => ({ kind: 'recette', id: r.id, nom: r.nom, entity: r, macros: recipePortionMacros(r) }))
    .filter(c => c.macros)
}

// Candidats d'une catégorie : recettes de cette catégorie (+ repas types de la
// même catégorie si `includeRepasTypes`), avec valeurs nutritionnelles
// exploitables et portion dimensionnable. Exporté : réutilisé par
// useMealPlanner pour proposer un remplacement de brique dans l'aperçu.
export function buildVivier(categorie, { recettes, repasTypes, season, seasonMode, includeRepasTypes = true, maxCookMinutes = null }) {
  const recs = recetteCandidates(recettes, categorie, season, seasonMode, maxCookMinutes)
  return includeRepasTypes
    ? [...recs, ...repasTypeCandidates(repasTypes, categorie, season, seasonMode)]
    : recs
}

// Candidat construit à partir d'un id de recette / repas type — sert aux
// recettes ÉPINGLÉES (slot.pinnedIds) : une recette imposée doit entrer dans le
// pool même si elle est écartée du vivier par le filtre saison strict ou le
// filtre temps de cuisine (choix explicite de l'utilisatrice → il l'emporte).
function candidateFromId(id, { recettes = [], repasTypes = [] }) {
  const r = recettes.find(x => x.id === id)
  if (r) {
    const macros = recipePortionMacros(r)
    if (macros) return { kind: 'recette', id: r.id, nom: r.nom, entity: r, macros }
  }
  const t = repasTypes.find(x => x.id === id)
  if (t) {
    const macros = templateServingMacros(t)
    if (macros && macros.kcal > 0) return { kind: 'repas_type', id: t.id, nom: t.nom, entity: t, macros }
  }
  return null
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

// ── Manques vitamines / minéraux (favoris) ─────────────────────────────────
// PALIER 2. Après avoir posé recettes + aliments « en + » macro, on regarde
// les manques du JOUR en vitamines / minéraux (mêmes VNR que l'Explorer, via
// getNutrientGaps) et on ajoute 0 à MAX_MICRO_ADDONS_PER_DAY favoris riches
// dans ces nutriments — dans la limite des calories qu'il reste à la journée.
// Pas d'optimisation globale : c'est une passe locale, jour par jour.
const MAX_MICRO_ADDONS_PER_DAY = 2
const MICRO_COLUMN_KEYS = [...new Set(CLAIM_MICRO_FIELDS.flatMap(f => f.sumKeys || [f.key]))]
const MICRO_FIELD_KEYS = new Set(CLAIM_MICRO_FIELDS.map(f => f.key))

// Ajoute à `acc` (indexé par clé de colonne brute, valeurs ABSOLUES) les
// vitamines / minéraux apportés par un item de repas du plan.
function addMicroContribution(acc, item, { recettesById, templatesById }) {
  if (item.kind === 'ajout') {
    const f = (item.qty_g || 0) / 100
    const src = item.food || {}
    for (const k of MICRO_COLUMN_KEYS) {
      const v = src[k]
      if (v != null) acc[k] = (acc[k] || 0) + Number(v) * f
    }
  } else if (item.kind === 'recette') {
    const rec = recettesById[item.id]
    if (!rec) return
    const f = ((item.portionG || 0) / 100) * (item.portions || 1) // colonnes recette = /100 g
    for (const k of MICRO_COLUMN_KEYS) {
      const v = rec[k]
      if (v != null) acc[k] = (acc[k] || 0) + Number(v) * f
    }
  } else if (item.kind === 'repas_type') {
    const tpl = templatesById[item.id]
    if (!tpl) return
    const parts = tpl.nb_portions || 1
    const f = (parts > 0 ? 1 / parts : 1) * (item.portions || 1) // items du repas type = valeurs absolues
    for (const tit of (tpl.items || [])) {
      for (const k of MICRO_COLUMN_KEYS) {
        const v = tit[k]
        if (v != null) acc[k] = (acc[k] || 0) + Number(v) * f
      }
    }
  }
}

// Répartit 0..MAX_MICRO_ADDONS_PER_DAY favoris sur les repas non verrouillés du
// jour pour combler les manques micro. Mute `usedAddonKeys` et les `items` /
// `totals` / `score` des repas hôtes. Retourne les items ajoutés.
function fillDayMicros(dayMicros, hostMeals, foods, settings, rng, usedAddonKeys, remainKcal) {
  const out = []
  let budget = remainKcal
  if (!hostMeals.length || budget <= MIN_RESIDUAL_KCAL || !foods.length) return out
  const micros = { ...dayMicros }

  for (let step = 0; step < MAX_MICRO_ADDONS_PER_DAY; step++) {
    if (budget <= MIN_RESIDUAL_KCAL) break
    const gaps = getNutrientGaps(micros, settings, 40).filter(g => MICRO_FIELD_KEYS.has(g.field.key))
    if (!gaps.length) break

    let placed = false
    for (const g of gaps) {
      const missing = getGapAmount(micros, settings, g.field)
      if (!missing || missing <= 0) continue
      const ranked = foods
        .filter(food => !usedAddonKeys.has(foodKey(food)))
        .map(food => ({ food, cov: gapCoverage(food, [{ field: g.field, missing }], budget) }))
        .filter(x => x.cov && x.cov.pct > 0 && x.cov.grams >= 5)
        .sort((a, b) => b.cov.pct - a.cov.pct)
      if (!ranked.length) continue

      const pick = pickWeighted(ranked.slice(0, 4), x => x.cov.pct, rng)
      if (!pick) continue
      const food = pick.food
      const gq = Math.max(5, Math.round(pick.cov.grams / 5) * 5)
      const factor = gq / 100
      const macros = {
        kcal: (food.energie_kcal || 0) * factor,
        prot: (food.proteines || 0) * factor,
        gluc: (food.glucides || 0) * factor,
        lip: (food.lipides || 0) * factor,
        fibres: (food.fibres || 0) * factor,
      }
      // Repas hôte = celui qui a le plus de marge calorique (on répartit).
      const host = hostMeals.slice().sort((a, b) =>
        (b.target.kcal - b.totals.kcal) - (a.target.kcal - a.totals.kcal))[0]
      const item = {
        kind: 'ajout', food, nom: food.alim_nom || food.food_name,
        qty_g: gq, macros, micro: g.field.label,
      }
      host.items.push(item)
      host.totals = addMacros(host.totals, macros)
      host.score = macroDistance(host.totals, host.target) + (host.totals.kcal > host.target.kcal * 1.12 ? 0.5 : 0)
      usedAddonKeys.add(foodKey(food))
      budget = Math.max(0, budget - macros.kcal)
      for (const k of MICRO_COLUMN_KEYS) {
        const v = food[k]
        if (v != null) micros[k] = Math.max(0, (micros[k] || 0) - Number(v) * factor)
      }
      out.push(item)
      placed = true
      break
    }
    if (!placed) break
  }
  return out
}

// Pénalité « portions gâchées » sur tout le plan : pour chaque recette / repas
// type, on somme les portions consommées et on regarde de combien il faudrait
// arrondir au multiple supérieur de son rendement (recette pour 4 utilisée 5
// fois → 3 portions cuisinées en trop → 3/4 de fournée gâchée). Poussée dans le
// score de la recherche locale pour préférer les combinaisons « propres ».
function leftoverPortionPenalty(dayList, recettesById, templatesById) {
  const used = new Map() // id -> { kind, n }
  for (const d of dayList) {
    for (const m of d.meals) {
      for (const it of m.items) {
        if (it.kind !== 'recette' && it.kind !== 'repas_type') continue
        const cur = used.get(it.id) || { kind: it.kind, n: 0 }
        cur.n += it.portions || 1
        used.set(it.id, cur)
      }
    }
  }
  let pen = 0
  for (const [id, { kind, n }] of used) {
    const baseYield = kind === 'recette'
      ? (recettesById[id]?.portions || 1)
      : (templatesById[id]?.nb_portions || 1)
    if (baseYield <= 1) continue // rendement 1 → tout compte est « propre »
    const rem = n % baseYield
    if (rem !== 0) pen += (baseYield - rem) / baseYield
  }
  return LEFTOVER_PORTION_WEIGHT * pen
}

// ── Construction du plan ───────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {number} p.days            1..7
 * @param {number} [p.people=1]      nombre de personnes (liste de courses)
 * @param {string|null} [p.season]   'Printemps'|'Été'|'Automne'|'Hiver'|null
 * @param {object} p.mealConfig      { [meal]: [{ categorie, nbDifferentes, pinnedIds? }] }
 *                                   pinnedIds : recettes / repas types imposés dans le pool de la catégorie.
 * @param {Array}  p.recettes        useRecipes().recettes
 * @param {Array}  p.repasTypes      liste des repas_types
 * @param {Array}  p.favorites       useFavorites().favorites
 * @param {object} p.mealTargets     computeMealTargets(settings)
 * @param {number} [p.goalFibres=0]  settings.goal_fibres
 * @param {boolean} [p.includeRepasTypes=true]  inclure les repas types dans les viviers
 * @param {number|null} [p.maxCookMinutes=null]  temps prépa + cuisson max (min) ; null = pas de filtre
 * @param {boolean} [p.fillMicros=true]  compléter les manques vitamines / minéraux du jour avec des favoris
 * @param {boolean} [p.allowDoublePortions=true]  autoriser 2 portions d'un même plat sur un repas quand ça rapproche des cibles
 * @param {object} [p.settings]      settings (pour getNutrientGaps : goal_proteines / goal_fibres ; VNR micro = fixes)
 * @param {object} [p.options]       { seasonMode:'bonus'|'filter', seed:number }
 * @param {object} [p.locked]        { `${dayIndex}|${meal}`: <objet repas figé de l'aperçu> }
 *                                   — repas verrouillés, repris tels quels à la régénération.
 * @returns {{ days:Array, weekTotals:object, weekScore:number, picks:object, warnings:Array }}
 */
export function buildMealPlan(p) {
  const {
    days, people = 1, season = null, mealConfig, recettes = [], repasTypes = [],
    favorites = [], mealTargets = {}, goalFibres = 0, includeRepasTypes = true,
    maxCookMinutes = null, fillMicros = true, allowDoublePortions = true,
    settings = {}, options = {}, locked = {},
  } = p
  const seasonMode = options.seasonMode === 'filter' ? 'filter' : 'bonus'
  const vivierCtx = { recettes, repasTypes, season, seasonMode, includeRepasTypes, maxCookMinutes }
  const rng = makeRng(options.seed || 1)
  const warnings = []
  const foods = favoriteFoods(favorites)
  const recettesById = Object.fromEntries((recettes || []).map(r => [r.id, r]))
  const templatesById = Object.fromEntries((repasTypes || []).map(t => [t.id, t]))

  const meals = Object.keys(mealConfig || {})

  // Slots regroupés par catégorie : « Plat » au déjeuner et au dîner partagent
  // UN vivier et UN pool de recettes tirées sur la période (pas N + N).
  const groupSlots = {} // categorie -> [{ meal, si, slot, target }]
  for (const meal of meals) {
    const slots = mealConfig[meal] || []
    const slotTargets = splitMealTarget(mealTargetWithFibres(mealTargets, meal, goalFibres), slots)
    slots.forEach((slot, si) => {
      const key = slotGroupKey(slot)
      ;(groupSlots[key] = groupSlots[key] || []).push({ meal, si, slot, target: slotTargets[si] })
    })
  }

  // 1. Vivier + pool de recettes tirées, par catégorie.
  const viviers = {}      // categorie -> [candidate,...]
  const vivierScored = {} // categorie -> [{ c, dist }] trié (réutilisé par la recherche locale)
  const picks = {}        // categorie -> [candidate,...] (pool partagé par les slots de la catégorie)
  const pinnedByKey = {}  // categorie -> Set d'ids épinglés (jamais remplacés en recherche locale)
  for (const [key, entries] of Object.entries(groupSlots)) {
    const viv = buildVivier(key, vivierCtx)
    viviers[key] = viv

    // Recettes imposées pour ce groupe (une ou plusieurs briques de même
    // catégorie mutualisent leur pinnedIds), reprises même si le vivier les a
    // écartées (saison stricte / temps de cuisine).
    const wantPinned = new Set(entries.flatMap(e => e.slot.pinnedIds || []))
    const chosen = []
    for (const id of wantPinned) {
      const fc = viv.find(c => c.id === id) || candidateFromId(id, vivierCtx)
      if (fc && !chosen.some(x => x.id === fc.id)) chosen.push(fc)
    }
    pinnedByKey[key] = new Set(chosen.map(c => c.id))

    if (!viv.length && !chosen.length) {
      warnings.push(
        maxCookMinutes
          ? `Aucune recette « ${key} » sous ${maxCookMinutes} min — augmente le temps de cuisine max ou impose une recette.`
          : `Aucune recette disponible pour « ${key} ».`,
      )
      picks[key] = []
      continue
    }
    const avgTarget = averageTargets(entries.map(e => e.target))
    // Note d'un candidat : distance macro à la part de cible du slot, moins le
    // bonus saison, PLUS une pénalité si sa portion dépasse déjà la cible
    // calorique du slot (on préfère des recettes qui laissent de la marge).
    const scored = viv
      .map(c => ({
        c,
        dist: macroDistance(c.macros, avgTarget)
          - seasonBonus(c.entity, season)
          + (avgTarget.kcal > 0 && c.macros.kcal > avgTarget.kcal
            ? 0.6 * (c.macros.kcal - avgTarget.kcal) / avgTarget.kcal
            : 0),
      }))
      .sort((a, b) => a.dist - b.dist)
    vivierScored[key] = scored
    // Il faut au moins autant de recettes différentes que d'imposées.
    const nWanted = Math.max(...entries.map(e => e.slot.nbDifferentes || 1))
    const n = Math.max(1, nWanted, chosen.length)
    // Peu de choix dans cette catégorie → le plan a peu de marge pour ajuster.
    if (viv.length >= 1 && viv.length < n + 2) {
      warnings.push(
        `Peu de recettes « ${key} » (${viv.length}) — le plan a peu de marge pour coller aux calories. En ajouter quelques-unes, plutôt légères, améliorera le résultat.`,
      )
    }
    const poolSize = Math.min(scored.length, Math.max(n + 3, Math.ceil(scored.length * 0.5)))
    const cpool = scored.slice(0, poolSize).map(x => x.c).filter(c => !chosen.some(x => x.id === c.id))
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
          // Round-robin sur le pool : chaque bloc de `pool.length` occurrences
          // consécutives est une permutation complète du pool → les
          // `nbDifferentes` recettes demandées apparaissent TOUTES. Le
          // + floor(cur / pool.length) décale la permutation d'un cran à chaque
          // cycle, pour que midi/soir ne restent pas figés sur la même recette
          // tous les jours (ce que faisait l'ancien « + d », mais celui-ci
          // avançait en même temps que `cur` et sautait des entrées du pool).
          let cand = pool[(cur + Math.floor(cur / pool.length)) % pool.length]
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
            categorie: key, // = catégorie du slot, sert au remplacement de brique
            portions: 1,
            portionG: cand.macros._portionG || null,
            macros: { ...cand.macros },
            unitMacros: { ...cand.macros }, // référence « 1 portion » (doublement / réglage manuel)
          })
        })

        // 2 portions d'un même plat (PALIER 2) : si le repas reste loin sous sa
        // cible, on double la brique éligible qui l'en rapproche le plus — une
        // seule par repas, portions entières, sans faire déborder les calories.
        if (allowDoublePortions && items.length) {
          const base1 = items.reduce((acc, it) => addMacros(acc, it.macros), { ...EMPTY_MACROS })
          const dist1 = macroDistance(base1, target)
          let best = null // { idx, dist }
          items.forEach((it, idx) => {
            if (it.kind !== 'recette' && it.kind !== 'repas_type') return
            if (!DOUBLE_ELIGIBLE_CATEGORIES.has(it.categorie)) return
            const trial = addMacros(base1, it.macros) // brique comptée 2×
            if (trial.kcal > target.kcal * DOUBLE_KCAL_CEILING) return
            const d = macroDistance(trial, target)
            if (d < dist1 - 1e-6 && (!best || d < best.dist)) best = { idx, dist: d }
          })
          if (best) {
            const it = items[best.idx]
            it.portions = MAX_MEAL_PORTIONS
            it.macros = scaleMacros(it.unitMacros, MAX_MEAL_PORTIONS)
          }
        }

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

      // Passe vitamines / minéraux : on répartit 0..2 favoris sur les repas non
      // verrouillés du jour pour combler les manques micro, sans déborder les
      // calories restantes de la journée.
      if (fillMicros) {
        const dayMicros = {}
        for (const m of dayMeals) {
          for (const it of m.items) addMicroContribution(dayMicros, it, { recettesById, templatesById })
        }
        const lockedNames = new Set(meals.filter(mm => locked[`${d}|${mm}`]))
        const hostMeals = dayMeals.filter(m => !lockedNames.has(m.meal))
        const dayKcalTarget = meals.reduce((s, mm) => s + mealTargetWithFibres(mealTargets, mm, goalFibres).kcal, 0)
        const dayKcalSoFar = dayMeals.reduce((s, m) => s + m.totals.kcal, 0)
        fillDayMicros(dayMicros, hostMeals, foods, settings, rng, usedAddonKeys, dayKcalTarget - dayKcalSoFar)
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

  // Score global d'un plan : Σ scores jour + pénalité restes + pénalité de
  // DÉPASSEMENT (asymétrique) au niveau jour ET semaine — c'est ce dernier
  // terme qui pousse le solveur à ne pas déborder les calories / macros.
  const scorePlan = (dl) => {
    let s = leftoverPortionPenalty(dl, recettesById, templatesById)
    let wkT = { ...EMPTY_MACROS }
    let wkTgt = { ...EMPTY_MACROS }
    for (const d of dl) {
      s += d.score + overshootPenalty(d.totals, d.target)
      wkT = addMacros(wkT, d.totals)
      wkTgt = addMacros(wkTgt, d.target)
    }
    return s + overshootPenalty(wkT, wkTgt)
  }

  let dayList = build()
  let bestScore = scorePlan(dayList)

  // 3. Recherche locale : remplacer une recette d'un pool par une autre de son
  //    vivier, garder si le score global baisse. Recettes épinglées jamais
  //    touchées. Deux phases : (a) balayage glouton — pour chaque position
  //    libre, on essaie les meilleures alternatives et on garde la meilleure ;
  //    (b) passes aléatoires pour sortir des optima locaux.
  const swappableKeys = Object.keys(picks).filter(k => {
    const free = picks[k].filter(c => !pinnedByKey[k]?.has(c.id)).length
    return free > 0 && (viviers[k] || []).length > picks[k].length
  })
  const altsFor = (key, pool) => (vivierScored[key] || [])
    .map(x => x.c)
    .filter(c => !pool.some(p => p.id === c.id))
  const freeIdxFor = (key, pool) => pool
    .map((_, i) => i)
    .filter(i => !pinnedByKey[key]?.has(pool[i].id))

  // (a) balayage glouton
  for (const key of swappableKeys) {
    const pool = picks[key]
    for (const idx of freeIdxFor(key, pool)) {
      let bestAlt = null
      let bestAltScore = bestScore
      let tried = 0
      for (const alt of altsFor(key, pool)) {
        if (tried >= SWEEP_MAX_ALTS) break
        tried++
        const prev = pool[idx]
        pool[idx] = alt
        const ts = scorePlan(build())
        pool[idx] = prev
        if (ts < bestAltScore - 1e-6) { bestAltScore = ts; bestAlt = alt }
      }
      if (bestAlt) {
        pool[idx] = bestAlt
        dayList = build()
        bestScore = bestAltScore
      }
    }
  }

  // (b) passes aléatoires
  for (let round = 0; round < LOCAL_SEARCH_ROUNDS && swappableKeys.length; round++) {
    const key = swappableKeys[Math.floor(rng() * swappableKeys.length)]
    const pool = picks[key]
    const alts = altsFor(key, pool)
    const freeIdx = freeIdxFor(key, pool)
    if (!alts.length || !freeIdx.length) continue
    const alt = alts[Math.floor(rng() * alts.length)]
    const replaceIdx = freeIdx[Math.floor(rng() * freeIdx.length)]
    const prev = pool[replaceIdx]
    pool[replaceIdx] = alt
    const trial = build()
    const trialScore = scorePlan(trial)
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
        const cur = map.get(it.id) || {
          id: it.id, nom: it.nom, kind: it.kind,
          categorie: it.categorie || null, portionsNeeded: 0,
        }
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

// Config de repas par défaut : une brique par repas actif, catégorie déduite du
// repas. Les repas types de chaque catégorie sont inclus par défaut dans les
// viviers (interrupteur `includeRepasTypes`).
export function defaultMealConfig(mealTargets) {
  const map = {
    'Petit-déjeuner': { categorie: 'Petit-déjeuner', nbDifferentes: 2 },
    'Déjeuner': { categorie: 'Plat', nbDifferentes: 2 },
    'Dîner': { categorie: 'Plat', nbDifferentes: 2 },
    'Collation': { categorie: 'Collation', nbDifferentes: 1 },
  }
  const cfg = {}
  for (const [meal, slot] of Object.entries(map)) {
    if (mealTargets?.[meal]?.enabled === false) continue
    cfg[meal] = [{ ...slot }]
  }
  return cfg
}
