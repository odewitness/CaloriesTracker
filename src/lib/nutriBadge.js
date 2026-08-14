// ─────────────────────────────────────────────────────────────────────────────
// getNutriBadge — petit badge nutritionnel (emoji + libellé) calculé sur les
// valeurs /100g d'un aliment ou d'une recette. Protéines et fibres utilisent
// les seuils des allégations nutritionnelles officielles (règlement UE
// n°1924/2006, annexe) : "riche en protéines" ≥ 20% de l'énergie apportée par
// les protéines, "riche en fibres" ≥ 6g/100g. Il n'existe pas d'allégation
// officielle "riche en glucides/lipides" (aucun intérêt nutritionnel à le
// valoriser) — pour ces deux-là on retombe sur un simple critère de
// dominance : le macro fournit à lui seul plus de la moitié de l'énergie.
// Un seul badge (le premier qui matche) ; pas de badge si aucun ne matche —
// mieux vaut l'absence de badge qu'un badge peu pertinent.
// ─────────────────────────────────────────────────────────────────────────────
export function getNutriBadge(n) {
  if (n.energie_kcal == null) return null
  const kcalP = (n.proteines || 0) * 4
  const kcalG = (n.glucides  || 0) * 4
  const kcalL = (n.lipides   || 0) * 9
  const totalKcal = kcalP + kcalG + kcalL
  if (totalKcal <= 0) return null
  if (kcalP / totalKcal >= 0.20) {
    return { emoji: '💪', label: 'Riche en protéines', bg: 'var(--green-light)', color: 'var(--green-dark)' }
  }
  if ((n.fibres || 0) >= 6) {
    return { emoji: '🌾', label: 'Riche en fibres', bg: 'var(--amber-light)', color: '#8A5A0F' }
  }
  if (kcalG / totalKcal > 0.50) {
    return { emoji: '⚡', label: 'Riche en glucides', bg: 'var(--amber-light)', color: 'var(--amber)' }
  }
  if (kcalL / totalKcal > 0.50) {
    return { emoji: '🥑', label: 'Riche en lipides', bg: 'var(--coral-light)', color: 'var(--coral)' }
  }
  return null
}
