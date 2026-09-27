// Ordre des blocs de la page du jour (voir DaySlot dans src/pages/TodayPage.jsx).
// L'utilisatrice le règle depuis Profil > Page du jour ; il est persisté dans
// `settings.ordre_sections_jour` (jsonb) et partagé sur tous les jours.
//
// Seuls ces blocs de contenu sont réordonnables. La barre de raccourcis et la
// pastille de phase du cycle restent fixées en haut.

export const TODAY_SECTION_KEYS = ['phase', 'bilan', 'nutriments', 'manques', 'repas', 'fodmap', 'sommeil', 'sport', 'complements', 'eau', 'transit']

export const TODAY_SECTION_LABELS = {
  phase: 'Phase du cycle',
  bilan: 'Bilan calorique',
  nutriments: 'Détail des nutriments',
  manques: 'À combler aujourd\'hui',
  repas: 'Repas du jour',
  fodmap: 'FODMAP',
  sommeil: 'Sommeil',
  sport: 'Activité',
  complements: 'Compléments',
  eau: 'Eau',
  transit: 'Transit',
}

export const DEFAULT_TODAY_SECTIONS_ORDER = [...TODAY_SECTION_KEYS]

// Fusion défensive, même esprit que mergeWaterSettings : on garde les clés
// connues de `raw` dans l'ordre fourni (en dédupliquant), puis on réinsère les
// clés manquantes à leur place attendue (pas en fin — pour qu'un bloc ajouté
// après coup, comme « phase » ou « sommeil », arrive au bon endroit chez les
// utilisatrices ayant déjà un ordre enregistré) : juste AVANT le premier bloc
// qui le suit dans l'ordre par défaut et qui est déjà placé (« sommeil » se
// cale ainsi avant « sport » même si l'ordre a été personnalisé), en fin de
// liste s'il n'y en a aucun. Une valeur corrompue ou `null` retombe sur
// l'ordre par défaut complet.
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
    if (seen.has(k)) return
    const anchor = DEFAULT_TODAY_SECTIONS_ORDER.slice(di + 1).find(a => seen.has(a))
    const at = anchor ? out.indexOf(anchor) : out.length
    seen.add(k)
    out.splice(at, 0, k)
  })
  return out
}
