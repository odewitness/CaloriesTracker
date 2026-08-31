// ─────────────────────────────────────────────────────────────────────────────
// mealPlannerApply — transforme un plan (sortie de buildMealPlan) en lignes
// `repas_planifies` prêtes à insérer. PUR (aucune dépendance React/Supabase) :
// le hook useMealPlanner charge les données manquantes (ingrédients de recette,
// jours exclus, repas déjà planifiés) et fait l'insert.
//
// Une brique « recette » est développée en SES INGRÉDIENTS mis à l'échelle
// d'UNE portion (1 / recette.portions) — même choix que PlanMealModal, pour que
// la liste de courses générée depuis ces repas prévus liste des aliments et non
// « 1 × Curry ». Idem pour un repas type (1 / nb_portions). Les aliments « en +
// » passent par scaleFood.
//
// Voir docs/planificateur-repas.md.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from './dates'
import { scaleFood, ALL_NUTRIENT_KEYS } from './nutrients'

const BASE_NUM_KEYS = [
  'qty_g', 'energie_kcal', 'proteines', 'glucides', 'lipides', 'fibres',
  'sel', 'sucres', 'acides_gras_satures',
]

export function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

// ── Plans appliqués (localStorage) ────────────────────────────────────────
// Liste des plans générés puis appliqués au calendrier — sert au bouton
// « Retirer le plan généré de cette semaine » de la vue Menus (qui doit
// fonctionner après fermeture de la modale). On ne stocke que le
// recurrence_group_id partagé par les lignes du plan + de quoi dater. Purge des
// entrées de plus de 60 jours, plafond à 30 entrées.
const APPLIED_PLANS_KEY = 'meal-planner:applied-plans'
const APPLIED_MAX_AGE_MS = 60 * 24 * 3600 * 1000

export function readAppliedPlans() {
  try {
    const list = JSON.parse(localStorage.getItem(APPLIED_PLANS_KEY))
    if (!Array.isArray(list)) return []
    const cutoff = Date.now() - APPLIED_MAX_AGE_MS
    return list.filter(p => p && p.groupId && (p.appliedAt || 0) > cutoff)
  } catch { return [] }
}

function writeAppliedPlans(list) {
  try { localStorage.setItem(APPLIED_PLANS_KEY, JSON.stringify(list.slice(-30))) } catch { /* quota / privé */ }
}

export function stashAppliedPlan(info) {
  if (!info?.groupId) return
  const list = readAppliedPlans().filter(p => p.groupId !== info.groupId)
  list.push({ appliedAt: Date.now(), ...info })
  writeAppliedPlans(list)
}

export function removeAppliedPlan(groupId) {
  writeAppliedPlans(readAppliedPlans().filter(p => p.groupId !== groupId))
}

// Nettoie une référence : les chaînes "undefined" / "null" / "" (issues d'un
// stringify accidentel quelque part dans l'historique des données) doivent
// devenir null, sinon resolveCategories les envoie telles quelles dans un
// `.in('id', …)` sur une colonne uuid → « invalid input syntax for type uuid ».
function cleanRef(v) {
  return (v == null || v === 'undefined' || v === 'null' || v === '') ? null : v
}

// Remet à l'échelle un item DÉJÀ en valeurs absolues (ligne recette_ingredients
// ou item de repas type) par un facteur — garde uniquement les champs utiles à
// une entrée de `journal` / `repas_planifies`.
function scaleAbsoluteItem(item, factor) {
  const ref = cleanRef(item.food_ref_id)
  const out = {
    food_name: item.food_name,
    food_source: ref ? (item.food_source || null) : null,
    food_ref_id: ref,
  }
  for (const k of [...BASE_NUM_KEYS, ...ALL_NUTRIENT_KEYS]) {
    const v = item[k]
    if (typeof v === 'number') out[k] = parseFloat((v * factor).toFixed(4))
  }
  if (out.qty_g == null) out.qty_g = 0
  return out
}

/**
 * @param {object} plan  sortie de buildMealPlan
 * @param {object} ctx
 * @param {string} ctx.startDateStr        'YYYY-MM-DD' du jour 1 du plan
 * @param {Object<string,object>} ctx.recettesById
 * @param {Object<string,Array>}  ctx.ingredientsByRecetteId  { [recetteId]: [recette_ingredients] }
 * @param {Object<string,object>} ctx.templatesById
 * @param {Set<string>} [ctx.excludedDates]  dates 'YYYY-MM-DD' à ne pas planifier
 * @returns {{ rows: Array, skippedExcluded: string[] }}
 */
export function planToPlannedRows(plan, ctx) {
  const {
    startDateStr, recettesById = {}, ingredientsByRecetteId = {},
    templatesById = {}, excludedDates = new Set(),
  } = ctx
  const rows = []
  const skippedExcluded = []

  plan.days.forEach((day, di) => {
    const dateStr = addDaysStr(startDateStr, di)
    if (excludedDates.has(dateStr)) { skippedExcluded.push(dateStr); return }

    for (const meal of day.meals) {
      const items = []
      const briqueNames = []
      let briqueCount = 0
      let addonCount = 0
      let soloSource = null

      for (const it of meal.items) {
        if (it.kind === 'ajout') {
          addonCount++
          const scaled = scaleFood(it.food, it.qty_g)
          const ref = cleanRef(scaled.food_ref_id)
          items.push({ ...scaled, food_ref_id: ref, food_source: ref ? scaled.food_source : null })
        } else if (it.kind === 'recette') {
          briqueCount++
          briqueNames.push(it.nom)
          const rec = recettesById[it.id]
          const parts = rec?.portions || 1
          const factor = parts > 0 ? 1 / parts : 1
          for (const ing of (ingredientsByRecetteId[it.id] || [])) {
            items.push(scaleAbsoluteItem(ing, factor))
          }
          soloSource = { source_type: 'recette', source_id: it.id }
        } else if (it.kind === 'repas_type') {
          briqueCount++
          briqueNames.push(it.nom)
          const tpl = templatesById[it.id]
          const parts = tpl?.nb_portions || 1
          const factor = parts > 0 ? 1 / parts : 1
          for (const tit of (tpl?.items || [])) {
            items.push(scaleAbsoluteItem(tit, factor))
          }
          soloSource = { source_type: 'repas_type', source_id: it.id }
        }
      }

      // Filet de sécurité : pas d'item sans nom (colonnes NOT NULL côté
      // `journal` / `liste_courses_items` si ces lignes y sont recopiées).
      const cleanItems = items.filter(it => it && it.food_name)
      if (!cleanItems.length) continue
      const useSolo = briqueCount === 1 && addonCount === 0 && soloSource
      rows.push({
        date: dateStr,
        meal: meal.meal,
        nom: briqueNames.join(' + ') || meal.meal,
        items: cleanItems,
        source_type: useSolo ? soloSource.source_type : 'libre',
        source_id: useSolo ? soloSource.source_id : null,
      })
    }
  })

  return { rows, skippedExcluded }
}
