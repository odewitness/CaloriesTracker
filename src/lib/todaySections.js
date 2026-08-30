// Ordre des blocs de la page du jour (voir DaySlot dans src/pages/TodayPage.jsx).
// L'utilisatrice le règle depuis Profil > Page du jour ; il est persisté dans
// `settings.ordre_sections_jour` (jsonb) et partagé sur tous les jours.
//
// Seuls ces 6 blocs de contenu sont réordonnables. La barre de raccourcis et la
// pastille de phase du cycle restent fixées en haut.

export const TODAY_SECTION_KEYS = ['phase', 'bilan', 'nutriments', 'manques', 'repas', 'complements', 'eau']

export const TODAY_SECTION_LABELS = {
  phase: 'Phase du cycle',
  bilan: 'Bilan calorique',
  nutriments: 'Détail des nutriments',
  manques: 'À combler aujourd\'hui',
  repas: 'Repas du jour',
  complements: 'Compléments',
  eau: 'Eau',
}

export const DEFAULT_TODAY_SECTIONS_ORDER = [...TODAY_SECTION_KEYS]

// Fusion défensive, même esprit que mergeWaterSettings : on garde les clés
// connues de `raw` dans l'ordre fourni (en dédupliquant), puis on réinsère les
// clés manquantes à leur position par défaut (pas en fin — pour qu'un bloc
// ajouté après coup, comme « phase », arrive à sa place attendue chez les
// utilisatrices ayant déjà un ordre enregistré). Une valeur corrompue ou `null`
// retombe sur l'ordre par défaut complet.
export function normalizeTodaySectionsOrder(raw) {
  const seen = new Set()
  const out = []
  if (Array.isArray(raw)) {
    for (const k of raw) {
      if (TODAY_SECTION_KEYS.includes(k) && !seen.has(k)) {
        seen.add(k)
        out.push(k)
      }
    }
  }
  DEFAULT_TODAY_SECTIONS_ORDER.forEach((k, di) => {
    if (!seen.has(k)) {
      seen.add(k)
      out.splice(Math.min(di, out.length), 0, k)
    }
  })
  return out
}
