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

// ── Dernier plan appliqué (localStorage) ──────────────────────────────────
// Sert au bouton « Retirer le plan généré » de la vue Menus, qui doit
// fonctionner après fermeture de la modale. On ne stocke que de quoi cibler la
// suppression : le recurrence_group_id partagé par toutes les lignes du plan.
const LAST_PLAN_KEY = 'meal-planner:last-applied'

export function stashAppliedPlan(info) {
  try { localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(info)) } catch { /* quota / privé */ }
}
export function readAppliedPlan() {
  try { return JSON.parse(localStorage.getItem(LAST_PLAN_KEY)) || null } catch { return null }
}
export function clearAppliedPlan() {
  try { localStorage.removeItem(LAST_PLAN_KEY) } catch { /* ignore */ }
}

// Remet à l'échelle un item DÉJÀ en valeurs absolues (ligne recette_ingredients
// ou item de repas type) par un facteur — garde uniquement les champs utiles à
// une entrée de `journal` / `repas_planifies`.
function scaleAbsoluteItem(item, factor) {
  const out = {
    food_name: item.food_name,
    food_source: item.food_source || null,
    food_ref_id: item.food_ref_id || null,
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
          items.push(scaleFood(it.food, it.qty_g))
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
