// ─────────────────────────────────────────────────────────────────────────────
// getNutrientStatus — statut d'une valeur de vitamine/minéral par rapport à sa
// référence (RNP = besoin, ou objectif max pour les nutriments "limite" comme
// le sel). Extrait de NutrientPanel pour être réutilisé ailleurs (ex. carte
// aliment complément alimentaire).
//
// Nutriments normaux (limite = false) : plus on s'approche de la ref, mieux
// c'est. Nutriments "limite" (ex. Sel, Sodium) : ref = max à ne pas dépasser,
// donc rester en dessous = bien (vert), dépasser = pas bien (ambre/rouge).
// ─────────────────────────────────────────────────────────────────────────────
export function getNutrientStatus(val, ref, lss, limite) {
  if (limite) {
    if (lss !== null && val >= lss) return 'excess'
    if (val >= ref) return 'mid'
    return 'ok'
  }
  if (lss !== null && val >= lss) return 'excess'
  if (val >= ref)                  return 'ok'
  if (val >= ref * 0.5)            return 'mid'
  return 'low'
}

export const NUTRIENT_STATUS_COLOR = {
  excess: 'var(--coral)',
  ok:     '#1D9E75',
  mid:    'var(--amber)',
  low:    'var(--coral)',
}
