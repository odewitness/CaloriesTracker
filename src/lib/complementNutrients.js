import { VITAMIN_FIELDS, MINERAL_FIELDS } from './nutrients'
import { getNutrientStatus } from './nutrientStatus'

// ─────────────────────────────────────────────────────────────────────────────
// getComplementNutrients — pour un complément alimentaire, les calories/macros
// n'ont aucun intérêt (une dose de vitamine D n'a pas de "protéines") : on
// calcule à la place les vitamines/minéraux réellement renseignés sur le
// produit (valeurs stockées /100g comme le reste du schéma), à l'échelle
// `scale` (ex: qty_g / 100), avec leur %AJR et statut (mêmes références que
// VitaminPanel). Utilisé par la carte Aliments (CustomFoodsSection) et le
// sélecteur d'ajout au journal (FoodPicker) — une seule source de vérité.
// ─────────────────────────────────────────────────────────────────────────────
export function getComplementNutrients(food, scale) {
  return [...VITAMIN_FIELDS, ...MINERAL_FIELDS]
    .map(field => {
      const val = (field.sumKeys || [field.key]).reduce((s, k) => s + (food[k] || 0), 0) * scale
      return { field, val }
    })
    .filter(({ val }) => val > 0)
    .map(({ field, val }) => ({
      field, val,
      pct: Math.round((val / field.ref) * 100),
      status: getNutrientStatus(val, field.ref, field.lss, field.limite),
    }))
}
