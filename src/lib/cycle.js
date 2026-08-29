// ─────────────────────────────────────────────────────────────────────────────
// cycle.js — calcul de la phase du cycle menstruel à partir des dates de 1er
// jour des règles saisies à la main (table `regles`, voir src/hooks/useCycle.js
// et docs/cycle-menstruel.md).
//
// Tout est en fonctions pures + chaînes 'YYYY-MM-DD' (mêmes dates que Supabase).
// Rappel scientifique (voir docs/cycle-menstruel.md) : les effets nutritionnels
// par phase sont réels mais MODESTES et les études hétérogènes. L'app informe
// et propose, elle n'impose pas. On prédit en comptant à rebours depuis les
// prochaines règles estimées, car la phase lutéale (~14 j) est bien plus stable
// que la phase folliculaire.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from './dates'

// Bloc `settings.cycle` — même principe que `settings.water` : fusionné côté
// client avec ces défauts (mergeCycleSettings), robuste si la colonne est
// absente ou partielle.
export const CYCLE_DEFAULTS = {
  enabled: false,             // toute la fonctionnalité est opt-in
  sous_contraception: false,  // true => neutralise la logique de phases
  longueur_cycle: 28,         // utilisé si auto_longueur_cycle = false ou pas assez d'historique
  auto_longueur_cycle: true,  // longueur = médiane observée dès qu'on a assez de cycles
  longueur_luteale: 14,
  longueur_regles: 5,
  afficher_sur_calendrier: true,
  afficher_badge_jour: true,
  afficher_conseils_micro: true,
  // Palier 3 (pas encore branché) :
  appliquer_delta_energie: false,
  delta_energie_luteale_kcal: 120,
}

export function mergeCycleSettings(raw) {
  return { ...CYCLE_DEFAULTS, ...(raw || {}) }
}

// ── Helpers dates ('YYYY-MM-DD', fuseau local, midi pour éviter tout souci DST)
function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}
export function addDays(s, n) {
  const d = parseYMD(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
export function daysBetween(a, b) {
  // b - a, en jours entiers
  return Math.round((parseYMD(b) - parseYMD(a)) / 86400000)
}

// ── Statistiques sur l'historique des débuts de règles ──────────────────────
export function sortedStarts(starts) {
  return [...new Set((starts || []).filter(Boolean))].sort()
}

// Écarts (en jours) entre débuts de règles successifs.
export function cycleLengths(starts) {
  const s = sortedStarts(starts)
  const out = []
  for (let i = 1; i < s.length; i++) out.push(daysBetween(s[i - 1], s[i]))
  return out
}

// On ignore les écarts < 15 j ou > 60 j : saisie oubliée / cycle non enregistré,
// pas une vraie longueur de cycle.
function plausibleLengths(starts, window) {
  const lens = cycleLengths(starts).filter(n => n >= 15 && n <= 60)
  return window ? lens.slice(-window) : lens
}

// Médiane des longueurs de cycle plausibles récentes, ou null si aucune.
export function observedCycleLength(starts, window = 6) {
  const lens = plausibleLengths(starts, window)
  if (!lens.length) return null
  const sorted = [...lens].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// Écart-type des longueurs récentes (régularité), ou null si < 2 cycles.
export function cycleLengthStdDev(starts, window = 6) {
  const lens = plausibleLengths(starts, window)
  if (lens.length < 2) return null
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length
  return Math.sqrt(variance)
}

// ── Phases ─────────────────────────────────────────────────────────────────
export const PHASE_ORDER = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale', 'inconnue']

export const PHASES = {
  menstruelle: {
    key: 'menstruelle',
    label: 'Règles',
    emoji: '🩸',
    color: 'var(--coral)',
    tagline: 'Pertes de fer — pense aux aliments riches en fer + vitamine C.',
  },
  folliculaire: {
    key: 'folliculaire',
    label: 'Phase folliculaire',
    emoji: '🌱',
    color: 'var(--green)',
    tagline: 'Bonne tolérance aux glucides, énergie en hausse. Rien de particulier à changer.',
  },
  ovulatoire: {
    key: 'ovulatoire',
    label: 'Ovulation',
    emoji: '✨',
    color: 'var(--blue)',
    tagline: 'Peu de données spécifiques : alimentation habituelle.',
  },
  luteale: {
    key: 'luteale',
    label: 'Phase lutéale',
    emoji: '🌙',
    color: 'var(--purple)',
    tagline: 'Appétit un peu plus élevé (~+150 kcal), fringales de sucre possibles. Protéines vers le haut, glucides plutôt complexes, calcium et magnésium.',
  },
  inconnue: {
    key: 'inconnue',
    label: 'Phase à confirmer',
    emoji: '❔',
    color: 'var(--text-hint)',
    tagline: 'En attente de tes prochaines règles pour resituer le cycle.',
  },
}

// Conseils par phase, formulés avec prudence (voir garde-fous du doc). Servira
// à la page d'info du Palier 2 ; exposé ici pour rester au même endroit.
export const PHASE_GUIDANCE = {
  menstruelle: {
    focus: ['Fer (+ vitamine C pour l\'absorption)'],
    notes: 'Les règles font perdre ~15–30 mg de fer. Privilégie les aliments qui en contiennent, associés à une source de vitamine C. Une supplémentation ne se décide qu\'avec un bilan sanguin (ferritine).',
  },
  folliculaire: {
    focus: [],
    notes: 'La sensibilité à l\'insuline est à son meilleur : c\'est le moment le plus confortable pour les glucides. Alimentation habituelle.',
  },
  ovulatoire: {
    focus: [],
    notes: 'Phase courte et peu étudiée côté nutrition. Rien à ajuster.',
  },
  luteale: {
    focus: ['Calcium', 'Magnésium', 'Protéines (haut de ta fourchette)'],
    notes: 'Léger surcroît d\'appétit et de dépense au repos (ordre de grandeur ~+150 kcal/j, données modestes). Fringales de sucre fréquentes en fin de phase : des glucides plutôt complexes, répartis, aident plus que du sucre rapide. Un peu plus de fibres (transit ralenti) et modérer le sel (rétention d\'eau) peuvent aider au confort. Le poids peut monter de 0,5 à 2 kg : c\'est de l\'eau, pas de la graisse.',
  },
  inconnue: {
    focus: [],
    notes: '',
  },
}

// ── Calcul principal ───────────────────────────────────────────────────────
// dateStr : jour pour lequel on veut la phase ('YYYY-MM-DD', typiquement
//   aujourd'hui, mais on l'appelle aussi par case de calendrier).
// starts  : toutes les dates de 1er jour des règles connues.
// cfg     : bloc settings.cycle (sera fusionné avec les défauts).
export function cycleInfo(dateStr, starts, cfg) {
  const settings = mergeCycleSettings(cfg)
  const s = sortedStarts(starts)
  if (!s.length) return { phase: 'inconnue', reason: 'no-data', settings }

  // Dernier début de règles connu à cette date (inclus).
  let lastStart = null
  for (const d of s) {
    if (d <= dateStr) lastStart = d
    else break
  }
  if (!lastStart) return { phase: 'inconnue', reason: 'future-only', settings }

  const jourCycle = daysBetween(lastStart, dateStr) + 1 // J1 = jour du début des règles

  // Longueur de cycle à utiliser :
  //  - si un début de règles postérieur est enregistré, on connaît la vraie
  //    longueur de CE cycle → on l'utilise (tinte l'historique correctement) ;
  //  - sinon, médiane observée (si auto + assez d'historique), sinon réglage.
  const nextRecorded = s.find(d => d > lastStart)
  const observed = settings.auto_longueur_cycle ? observedCycleLength(s) : null
  const predictedLen = observed || settings.longueur_cycle
  const cycleLen = nextRecorded ? daysBetween(lastStart, nextRecorded) : predictedLen

  const lutealLen = settings.longueur_luteale
  const reglesLen = settings.longueur_regles

  const nextStart = nextRecorded || addDays(lastStart, predictedLen)
  const lutealStart = addDays(nextStart, -lutealLen)
  const ovulation = addDays(lutealStart, -1)
  const overdueBy = nextRecorded ? 0 : daysBetween(nextStart, dateStr) // > 0 => en retard

  let phase
  if (settings.sous_contraception) {
    // Sous contraception hormonale : le cycle naturel ne s'exprime pas, on ne
    // qualifie que les jours de règles saisis, pas de phases.
    phase = jourCycle <= reglesLen ? 'menstruelle' : 'inconnue'
  } else if (overdueBy > 7) {
    phase = 'inconnue'
  } else if (jourCycle <= reglesLen) {
    phase = 'menstruelle'
  } else if (dateStr < addDays(ovulation, -1)) {
    phase = 'folliculaire'
  } else if (dateStr <= addDays(ovulation, 1)) {
    phase = 'ovulatoire'
  } else {
    phase = 'luteale'
  }

  // Fiabilité de la prédiction des prochaines règles.
  const nCycles = plausibleLengths(s).length
  const sd = cycleLengthStdDev(s)
  let fiabilite = 'faible'
  if (nCycles >= 3 && sd != null && sd <= 4 && overdueBy <= 3) fiabilite = 'bonne'
  else if (nCycles >= 2 && overdueBy <= 5) fiabilite = 'moyenne'

  const margin = sd == null ? 3 : Math.min(5, Math.max(1, Math.ceil(sd)))

  return {
    settings,
    phase,
    jourCycle,
    cycleLen,
    observedCycleLen: observed,
    predictedLen,
    lastStart,
    nextStart,
    nextStartFrom: addDays(nextStart, -margin),
    nextStartTo: addDays(nextStart, margin),
    lutealStart,
    ovulation,
    overdueBy,
    fiabilite,
    margin,
    nCycles,
    sousContraception: settings.sous_contraception,
  }
}

// Phase seule pour une date (utilisé pour teinter le calendrier).
export function phaseForDate(dateStr, starts, cfg) {
  return cycleInfo(dateStr, starts, cfg).phase
}

// { 'YYYY-MM-DD': { phase, isStart } } pour toutes les dates d'une plage
// inclusive — pratique pour une grille de calendrier.
export function phasesForRange(startStr, endStr, starts, cfg) {
  const startSet = new Set(sortedStarts(starts))
  const out = {}
  let cur = startStr
  let guard = 0
  while (cur <= endStr && guard < 400) {
    out[cur] = { phase: phaseForDate(cur, starts, cfg), isStart: startSet.has(cur) }
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

// "3–7 sept." à partir de deux 'YYYY-MM-DD' encadrant la prédiction.
export function formatPredictionWindow(fromStr, toStr) {
  const from = parseYMD(fromStr)
  const to = parseYMD(toStr)
  const dayFrom = from.getDate()
  const sameMonth = from.getMonth() === to.getMonth()
  const monthTo = to.toLocaleDateString('fr-FR', { month: 'short' })
  if (sameMonth) return `${dayFrom}–${to.getDate()} ${monthTo}`
  const monthFrom = from.toLocaleDateString('fr-FR', { month: 'short' })
  return `${dayFrom} ${monthFrom} – ${to.getDate()} ${monthTo}`
}
