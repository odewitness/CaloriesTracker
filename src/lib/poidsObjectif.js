// ─────────────────────────────────────────────────────────────────────────────
// poidsObjectif.js — objectif de poids PERSISTANT (poids désiré + date visée),
// voir docs/objectif-poids.md. Fonctions pures : compare le rythme nécessaire
// pour tenir l'objectif au rythme réel déjà calculé par useWeightProjection
// (régression sur les relevés de poids), sans dupliquer cette régression.
//
// Palier 2 : `requiredPaceKgPerWeek` est aussi consommé par
// useGoalAdjustment.js, qui l'utilise comme rythme visé (à la place de
// l'inférence depuis l'écart goal_kcal/TDEE) quand un objectif est défini.
//
// Correctif 2026-09-05 (retour utilisatrice : deux nombres différents
// proposés à deux endroits pour le même objectif) : `goalKcalDeltaForPace`
// est la SEULE formule qui convertit un écart de rythme (réel vs nécessaire)
// en kcal/jour, utilisée à la fois par useGoalAdjustment (ajustement doux,
// plafonné ±100/semaine) et par GoalWeightCard (bouton "Appliquer", correction
// complète en une fois) — évite que l'un propose un nombre issu de la vraie
// tendance de poids et l'autre un nombre théorique (formule de Mifflin-St
// Jeor), qui peuvent diverger de plusieurs centaines de kcal si le
// métabolisme réel de la personne s'écarte de l'estimation théorique.
// ─────────────────────────────────────────────────────────────────────────────

export const KCAL_PER_KG = 7700 // équivalence énergétique usuelle d'1 kg de masse grasse

// Bloc `settings.poids_objectif` — même principe que `settings.cycle` :
// fusionné côté client avec ces défauts, robuste si la colonne est absente.
export const GOAL_WEIGHT_DEFAULTS = {
  poids_desire: null,   // kg
  date_objectif: null,  // 'YYYY-MM-DD'
}

export function mergeGoalWeightSettings(raw) {
  return { ...GOAL_WEIGHT_DEFAULTS, ...(raw || {}) }
}

// Poids considéré comme atteint à ±0,3 kg près (bruit de balance).
const REACHED_TOLERANCE_KG = 0.3
// En-dessous, on considère le rythme réel conforme au rythme nécessaire
// plutôt que de signaler une avance/un retard pour un écart insignifiant.
const ON_TRACK_TOLERANCE_KG_WEEK = 0.1

function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function daysBetween(aStr, bStr) {
  return Math.round((parseYMD(bStr) - parseYMD(aStr)) / 86400000)
}

// Semaines restantes avant la date visée (négatif si déjà dépassée).
export function weeksRemaining(dateObjectif, today) {
  return daysBetween(today, dateObjectif) / 7
}

// Rythme (kg/semaine, signé — négatif = perte) qu'il faudrait tenir pour
// arriver pile à la date visée, à partir du poids actuel le plus fiable
// (`trendKg`, typiquement la tendance lissée de useWeightProjection). Utilisé
// à la fois par `goalWeightProgress` (affichage) et par `useGoalAdjustment`
// (ajustement hebdo, Palier 2) — seule source de vérité pour ce calcul.
// null si l'objectif est incomplet, ou si la date est déjà dépassée (dans ce
// cas l'appelant doit se rabattre sur son propre calcul par défaut).
export function requiredPaceKgPerWeek({ poidsDesire, dateObjectif, trendKg, today }) {
  if (poidsDesire == null || !dateObjectif || trendKg == null) return null
  const weeks = weeksRemaining(dateObjectif, today)
  if (weeks <= 0) return null
  return (poidsDesire - trendKg) / weeks
}

// Delta (kcal/jour, signé — positif = manger plus) à appliquer à goal_kcal
// pour que le rythme RÉEL rejoigne le rythme NÉCESSAIRE. Seule source de
// vérité pour cette conversion (voir note en tête de fichier). Formule
// sans branchement selon le sens (perte/prise) — se vérifie dans les 4 cas :
// perte trop lente → delta<0 (moins manger) ; perte trop rapide → delta>0
// (plus manger, ralentir) ; prise trop rapide → delta<0 ; prise trop lente
// → delta>0. null si l'un des deux rythmes est inconnu.
export function goalKcalDeltaForPace({ observedKgWeek, requiredKgWeek }) {
  if (observedKgWeek == null || requiredKgWeek == null) return null
  return ((requiredKgWeek - observedKgWeek) * KCAL_PER_KG) / 7
}

// Compare l'objectif (poids désiré + date) à la tendance réelle.
// `trendKg` : poids actuel le plus fiable dont on dispose (tendance lissée de
// useWeightProjection si elle existe, sinon le dernier relevé brut).
// `observedKgWeek` : rythme hebdo réel (trendWeekKg de useWeightProjection),
// null si pas encore assez de relevés pour une tendance fiable.
// `dateObjectif` peut être absente alors que `poidsDesire` est renseigné —
// choix explicite « Garder (sans date) » du Palier 3 (voir §3, statuts
// atteint/échéance dépassée) : poursuite d'un poids visé sans échéance,
// statut 'sans_echeance'. Renvoie null seulement si aucun poids désiré n'est
// renseigné, ou qu'aucun poids actuel n'est connu.
export function goalWeightProgress({ poidsDesire, dateObjectif, trendKg, observedKgWeek, today }) {
  if (poidsDesire == null || trendKg == null) return null

  const reached = Math.abs(trendKg - poidsDesire) <= REACHED_TOLERANCE_KG

  if (!dateObjectif) {
    return reached
      ? { status: 'atteint', poidsDesire, dateObjectif: null, trendKg, weeksRemaining: null }
      : { status: 'sans_echeance', poidsDesire, dateObjectif: null, trendKg, observedKgWeek, weeksRemaining: null }
  }

  const weeks = weeksRemaining(dateObjectif, today)

  if (reached) {
    return { status: 'atteint', poidsDesire, dateObjectif, trendKg, weeksRemaining: weeks }
  }
  if (weeks <= 0) {
    return { status: 'echeance_depassee', poidsDesire, dateObjectif, trendKg, weeksRemaining: weeks }
  }

  // Rythme qu'il faudrait tenir, chaque semaine, pour arriver pile à la date
  // visée — négatif si l'objectif est une perte de poids.
  const requiredKgWeek = requiredPaceKgPerWeek({ poidsDesire, dateObjectif, trendKg, today })

  if (observedKgWeek == null) {
    return { status: 'pas_assez_de_donnees', poidsDesire, dateObjectif, trendKg, weeksRemaining: weeks, requiredKgWeek }
  }

  // >0 : le rythme réel va plus vite qu'il ne faut vers l'objectif (en
  // avance) ; <0 : moins vite (en retard). Symétrique perte/prise.
  const advance = requiredKgWeek <= 0
    ? (requiredKgWeek - observedKgWeek)
    : (observedKgWeek - requiredKgWeek)

  const status = Math.abs(advance) < ON_TRACK_TOLERANCE_KG_WEEK
    ? 'dans_les_clous'
    : advance > 0 ? 'en_avance' : 'en_retard'

  return {
    status, poidsDesire, dateObjectif, trendKg, weeksRemaining: weeks,
    requiredKgWeek, observedKgWeek, gapKgWeek: advance,
  }
}
