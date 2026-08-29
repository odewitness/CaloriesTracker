// ─────────────────────────────────────────────────────────────────────────────
// cycle.js — calcul de la phase du cycle menstruel à partir des JOURS DE RÈGLES
// saisis à la main (table `regles`, une ligne = un jour ; voir
// src/hooks/useCycle.js et docs/cycle-menstruel.md).
//
// Les jours contigus sont regroupés en « blocs » de règles. Le 1er jour de
// chaque bloc sert de repère de cycle (écart d'un bloc au suivant = longueur
// de cycle observée). La durée des règles est donc RÉELLE par cycle, pas une
// valeur fixe.
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
  longueur_regles: 5,         // tolérance pour les jours pas encore marqués du cycle EN COURS
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

// ── Jours de règles → blocs ────────────────────────────────────────────────
export function periodDaySet(days) {
  return new Set((days || []).filter(Boolean))
}

// Jours de règles contigus regroupés : [{ start, end, length }], triés.
export function periodBlocks(days) {
  const s = [...new Set((days || []).filter(Boolean))].sort()
  const blocks = []
  for (const d of s) {
    const last = blocks[blocks.length - 1]
    if (last && daysBetween(last.end, d) === 1) {
      last.end = d
      last.length++
    } else {
      blocks.push({ start: d, end: d, length: 1 })
    }
  }
  return blocks
}

// 1er jour de chaque bloc — repère de cycle.
export function periodStarts(days) {
  return periodBlocks(days).map(b => b.start)
}

// ── Statistiques sur l'historique ──────────────────────────────────────────
// Écarts (jours) entre 1ers jours de règles successifs.
export function cycleLengths(days) {
  const s = periodStarts(days)
  const out = []
  for (let i = 1; i < s.length; i++) out.push(daysBetween(s[i - 1], s[i]))
  return out
}

// On ignore les écarts < 15 j ou > 60 j : bloc oublié / cycle non enregistré,
// pas une vraie longueur de cycle.
function plausibleLengths(days, window) {
  const lens = cycleLengths(days).filter(n => n >= 15 && n <= 60)
  return window ? lens.slice(-window) : lens
}

// Médiane des longueurs de cycle plausibles récentes, ou null si aucune.
export function observedCycleLength(days, window = 6) {
  const lens = plausibleLengths(days, window)
  if (!lens.length) return null
  const sorted = [...lens].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

// Écart-type des longueurs récentes (régularité), ou null si < 2 cycles.
export function cycleLengthStdDev(days, window = 6) {
  const lens = plausibleLengths(days, window)
  if (lens.length < 2) return null
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length
  return Math.sqrt(variance)
}

// Durée médiane des règles observée (nb de jours par bloc), ou null.
export function observedPeriodLength(days) {
  const b = periodBlocks(days)
  if (!b.length) return null
  const lens = [...b.map(x => x.length)].sort((a, b) => a - b)
  const mid = Math.floor(lens.length / 2)
  return lens.length % 2 ? lens[mid] : Math.round((lens[mid - 1] + lens[mid]) / 2)
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
// dateStr : jour pour lequel on veut la phase ('YYYY-MM-DD').
// days    : tous les jours de règles connus.
// cfg     : bloc settings.cycle (sera fusionné avec les défauts).
export function cycleInfo(dateStr, days, cfg) {
  const settings = mergeCycleSettings(cfg)
  const blocks = periodBlocks(days)
  if (!blocks.length) return { phase: 'inconnue', reason: 'no-data', settings }

  const dayset = periodDaySet(days)

  // Bloc courant = dernier bloc dont le 1er jour est <= dateStr.
  let bi = -1
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].start <= dateStr) bi = i
    else break
  }
  if (bi === -1) return { phase: 'inconnue', reason: 'future-only', settings }

  const block = blocks[bi]
  const nextBlock = blocks[bi + 1] || null
  const isCurrentCycle = !nextBlock
  const lastStart = block.start
  const jourCycle = daysBetween(lastStart, dateStr) + 1 // J1 = 1er jour des règles

  // Longueur de cycle :
  //  - bloc suivant connu → vraie longueur de CE cycle ;
  //  - sinon médiane observée (si auto + assez d'historique), sinon réglage.
  const observed = settings.auto_longueur_cycle ? observedCycleLength(days) : null
  const predictedLen = observed || settings.longueur_cycle
  const cycleLen = nextBlock ? daysBetween(lastStart, nextBlock.start) : predictedLen

  const lutealLen = settings.longueur_luteale
  const nextStart = nextBlock ? nextBlock.start : addDays(lastStart, predictedLen)
  const lutealStart = addDays(nextStart, -lutealLen)
  const ovulation = addDays(lutealStart, -1)
  const overdueBy = nextBlock ? 0 : daysBetween(nextStart, dateStr) // > 0 => en retard

  // Fin des règles : on fait confiance aux jours enregistrés du bloc. Pour le
  // cycle EN COURS uniquement, on tolère des jours pas encore marqués jusqu'à
  // `longueur_regles` (sinon un jour non saisi basculerait à tort en
  // folliculaire).
  const fallbackEnd = addDays(lastStart, Math.max(1, settings.longueur_regles) - 1)
  const menstrualEnd = isCurrentCycle && fallbackEnd > block.end ? fallbackEnd : block.end

  let phase
  if (settings.sous_contraception) {
    phase = dateStr <= menstrualEnd ? 'menstruelle' : 'inconnue'
  } else if (overdueBy > 7) {
    phase = 'inconnue'
  } else if (dateStr <= menstrualEnd || dayset.has(dateStr)) {
    phase = 'menstruelle'
  } else if (dateStr < addDays(ovulation, -1)) {
    phase = 'folliculaire'
  } else if (dateStr <= addDays(ovulation, 1)) {
    phase = 'ovulatoire'
  } else {
    phase = 'luteale'
  }

  const nCycles = plausibleLengths(days).length
  const sd = cycleLengthStdDev(days)
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
    observedPeriodLen: observedPeriodLength(days),
    predictedLen,
    lastStart,
    periodEnd: block.end,
    menstrualEnd,
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
export function phaseForDate(dateStr, days, cfg) {
  return cycleInfo(dateStr, days, cfg).phase
}

// { 'YYYY-MM-DD': { phase, isPeriod } } pour toutes les dates d'une plage
// inclusive — pratique pour une grille de calendrier.
export function phasesForRange(startStr, endStr, days, cfg) {
  const dayset = periodDaySet(days)
  const out = {}
  let cur = startStr
  let guard = 0
  while (cur <= endStr && guard < 400) {
    out[cur] = { phase: phaseForDate(cur, days, cfg), isPeriod: dayset.has(cur) }
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

// ── Palier 4 : nutriments à mettre en avant selon la phase ─────────────────
// Formulations douces, orientées aliments — jamais de dose de complément.
export const PHASE_MICRO_FOCUS = {
  menstruelle: [
    { key: 'fer',   label: 'Fer',         hint: 'Les règles en font perdre. À associer à une source de vitamine C.' },
    { key: 'vit_c', label: 'Vitamine C',  hint: "Aide à absorber le fer d'origine végétale." },
  ],
  luteale: [
    { key: 'calcium',   label: 'Calcium',   hint: "C'est le mieux étayé pour l'inconfort d'avant-règles." },
    { key: 'magnesium', label: 'Magnésium', hint: 'Peut aider sur la tension nerveuse et la rétention d\'eau.' },
  ],
}

export function microFocusForPhase(phase, cfg) {
  const s = mergeCycleSettings(cfg)
  if (!s.enabled || s.afficher_conseils_micro === false) return []
  return PHASE_MICRO_FOCUS[phase] || []
}

// Pour la phase courante : les nutriments à privilégier, chacun avec les
// aliments des FAVORIS de l'utilisatrice qui en contiennent le plus (pour 100 g).
// `favorites` = lignes de la table `favoris` (voir useFavorites). Renvoie []
// si rien à montrer — l'appelant s'en sert aussi pour décider s'il y a du
// contenu à déplier.
export function cycleNutrientRows(phase, favorites, cfg, perNutrient = 6) {
  const focus = microFocusForPhase(phase, cfg)
  if (!focus.length) return []
  return focus
    .map(f => ({
      ...f,
      foods: (favorites || [])
        .map(fav => ({
          id: fav.id,
          name: fav.food_data?.alim_nom || fav.food_name || '',
          val: Number(fav.food_data?.[f.key]) || 0,
        }))
        .filter(x => x.val > 0 && x.name)
        .sort((a, b) => b.val - a.val)
        .slice(0, perNutrient),
    }))
    .filter(r => r.foods.length > 0)
}

// ── Palier 3 : ajustement énergétique lutéal (opt-in) ──────────────────────
// Delta (kcal) à ajouter à l'objectif du jour pour une phase donnée, selon les
// réglages. 0 si non applicable. Données modestes : ~+150 kcal en phase lutéale
// (voir docs/cycle-menstruel.md §2).
export function energyDeltaForPhase(phase, cfg) {
  const s = mergeCycleSettings(cfg)
  if (!s.enabled || s.sous_contraception || !s.appliquer_delta_energie) return 0
  if (phase !== 'luteale') return 0
  const d = Number(s.delta_energie_luteale_kcal)
  return Number.isFinite(d) ? Math.round(d) : 0
}

// Renvoie `settings` avec `goal_kcal` ajusté du delta de phase pour `dateStr`.
// Objet inchangé (même référence) si aucun ajustement. Quand un ajustement
// s'applique, `_cycleKcalDelta` et `_cyclePhase` sont ajoutés pour l'affichage.
// Ne touche QUE goal_kcal : les macros ne sont pas recalculées (le nudge macros
// reste indicatif, voir la page d'info).
export function cycleAdjustedSettings(settings, days, dateStr) {
  const cfg = settings?.cycle
  const phase = (cfg?.enabled && Array.isArray(days) && days.length)
    ? phaseForDate(dateStr, days, cfg)
    : 'inconnue'
  const delta = energyDeltaForPhase(phase, cfg)
  if (!delta) return settings
  return {
    ...settings,
    goal_kcal: Math.max(0, Math.round((settings.goal_kcal || 0) + delta)),
    _cycleKcalDelta: delta,
    _cyclePhase: phase,
  }
}

// "3–7 sept." à partir de deux 'YYYY-MM-DD'.
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

// "3–7 août 2026" / "28 juil. – 2 août 2026" pour un bloc de règles.
export function formatDateRange(fromStr, toStr) {
  const from = parseYMD(fromStr)
  const to = parseYMD(toStr)
  const year = to.getFullYear()
  if (fromStr === toStr) {
    return `${from.getDate()} ${to.toLocaleDateString('fr-FR', { month: 'long' })} ${year}`
  }
  const sameMonth = from.getMonth() === to.getMonth()
  const monthTo = to.toLocaleDateString('fr-FR', { month: 'long' })
  if (sameMonth) return `${from.getDate()}–${to.getDate()} ${monthTo} ${year}`
  const monthFrom = from.toLocaleDateString('fr-FR', { month: 'short' })
  return `${from.getDate()} ${monthFrom} – ${to.getDate()} ${to.toLocaleDateString('fr-FR', { month: 'short' })} ${year}`
}
