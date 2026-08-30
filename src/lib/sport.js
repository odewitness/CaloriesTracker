// ─────────────────────────────────────────────────────────────────────────────
// sport.js — suivi des séances de sport (table `activites_sport`, une ligne =
// une séance). Voir src/hooks/useSport.js et docs/suivi-sport.md.
//
// Tout en fonctions pures + chaînes 'YYYY-MM-DD' (mêmes dates que Supabase).
// Rappel (voir docs/suivi-sport.md §2) : l'estimation de calories par MET est
// à ±15–30 % — toujours affichée « ≈ », jamais une cible sèche. Au Palier 1 le
// sport n'a AUCUN effet sur les objectifs caloriques.
// ─────────────────────────────────────────────────────────────────────────────

import { fmt } from './dates'

// Bloc `settings.sport` — même principe que `settings.water` : fusionné côté
// client avec ces défauts (mergeSportSettings), robuste si la colonne est
// absente ou partielle.
export const SPORT_DEFAULTS = {
  enabled: false,                 // toute la fonctionnalité est opt-in
  objectif_hebdo_minutes: 150,    // 0 = pas d'objectif en minutes
  objectif_hebdo_seances: 0,      // 0 = pas d'objectif en nombre de séances
  afficher_page_jour: true,
  afficher_calendrier: true,
  // Paliers 6/7 (pas branchés au Palier 1) :
  mode_energie: 'aucun',          // 'aucun' | 'bilan' | 'manger_selon_effort'
  depense_max_creditee_kcal: 400,
  // Palier 9 :
  rappels: { enabled: false, jours: [], heure: 18 },
  // Palier 5 (affichage seulement — jamais de token ici) :
  strava: { connected: false, athlete_nom: null, derniere_synchro: null, auto: true },
}

export function mergeSportSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return {
    ...SPORT_DEFAULTS,
    ...s,
    rappels: { ...SPORT_DEFAULTS.rappels, ...(s.rappels && typeof s.rappels === 'object' ? s.rappels : {}) },
    strava: { ...SPORT_DEFAULTS.strava, ...(s.strava && typeof s.strava === 'object' ? s.strava : {}) },
  }
}

// ── Types de séance ────────────────────────────────────────────────────────
// `met` : coût énergétique moyen (Compendium of Physical Activities), effort
// modéré. `distance` : true si un champ distance a du sens pour ce type.
export const SPORT_TYPES = [
  { key: 'course',   label: 'Course à pied',       emoji: '🏃', met: 9.0, distance: true },
  { key: 'marche',   label: 'Marche',              emoji: '🚶', met: 3.5, distance: true },
  { key: 'velo',     label: 'Vélo',                emoji: '🚴', met: 7.0, distance: true },
  { key: 'natation', label: 'Natation',            emoji: '🏊', met: 7.0, distance: true },
  { key: 'rando',    label: 'Randonnée',           emoji: '🥾', met: 6.0, distance: true },
  { key: 'muscu',    label: 'Musculation',         emoji: '🏋️', met: 5.0, distance: false },
  { key: 'hiit',     label: 'Cardio / HIIT',       emoji: '🔥', met: 8.0, distance: false },
  { key: 'yoga',     label: 'Yoga / étirements',   emoji: '🧘', met: 3.0, distance: false },
  { key: 'danse',    label: 'Danse',               emoji: '💃', met: 5.0, distance: false },
  { key: 'sport_co', label: 'Sport co / raquette', emoji: '🏐', met: 7.0, distance: false },
  { key: 'autre',    label: 'Autre',               emoji: '🤸', met: 5.0, distance: false },
]

export const SPORT_TYPE_KEYS = SPORT_TYPES.map(t => t.key)

export function sportType(key) {
  return SPORT_TYPES.find(t => t.key === key) || null
}
export function sportTypeLabel(key) {
  return sportType(key)?.label || 'Séance'
}
export function sportTypeEmoji(key) {
  return sportType(key)?.emoji || '🤸'
}

// ── Intensité ressentie ────────────────────────────────────────────────────
// Module l'estimation MET (grossier, assumé — voir docs/suivi-sport.md §2.1).
export const SPORT_INTENSITES = [
  { key: 'faible',  label: 'Faible',  mult: 0.85 },
  { key: 'moderee', label: 'Modérée', mult: 1.0 },
  { key: 'elevee',  label: 'Élevée',  mult: 1.15 },
]
export function sportIntensiteLabel(key) {
  return SPORT_INTENSITES.find(i => i.key === key)?.label || null
}

// ── Estimation des calories d'une séance ───────────────────────────────────
// kcal ≈ MET × 3,5 × poids_kg / 200 × durée_min, modulé par l'intensité.
// Renvoie null si on n'a pas de quoi estimer (type inconnu, poids ou durée
// manquants). À afficher « ≈ », jamais comme une valeur exacte.
export function estimateKcal({ type, poidsKg, dureeMin, intensite } = {}) {
  const t = sportType(type)
  const w = Number(poidsKg)
  const d = Number(dureeMin)
  if (!t || !w || w <= 0 || !d || d <= 0) return null
  const mult = SPORT_INTENSITES.find(i => i.key === intensite)?.mult ?? 1
  return Math.round((t.met * mult * 3.5 * w / 200) * d)
}

// ── Semaine (lundi → dimanche, convention FR) ──────────────────────────────
function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}
export function weekStart(dateStr) {
  const d = parseYMD(fmt(dateStr))
  const weekday = (d.getDay() + 6) % 7 // 0 = lundi
  d.setDate(d.getDate() - weekday)
  return fmt(d)
}
export function weekEnd(dateStr) {
  const d = parseYMD(weekStart(dateStr))
  d.setDate(d.getDate() + 6)
  return fmt(d)
}
export function isInWeek(dateStr, anyDateInWeek) {
  const s = weekStart(anyDateInWeek)
  const e = weekEnd(anyDateInWeek)
  const x = fmt(dateStr)
  return x >= s && x <= e
}
export function addWeeks(weekStartStr, k) {
  const d = parseYMD(fmt(weekStartStr))
  d.setDate(d.getDate() + k * 7)
  return fmt(d)
}

// Regroupe les séances par semaine (clé = lundi 'YYYY-MM-DD').
export function statsByWeek(activites) {
  const out = {}
  for (const a of activites || []) {
    const ws = weekStart(a.date)
    if (!out[ws]) out[ws] = { minutes: 0, seances: 0, kcal: 0 }
    out[ws].minutes += Number(a.duree_min) || 0
    out[ws].seances += 1
    out[ws].kcal += Number(a.energie_kcal) || 0
  }
  return out
}

// Nombre de semaines complètes consécutives où l'objectif de minutes est
// atteint, en terminant par la semaine EN COURS si elle l'atteint déjà, sinon
// par la semaine précédente (une semaine en cours pas encore bouclée ne casse
// pas la série). 0 si pas d'objectif. Volontairement sobre — aucun message de
// « série cassée » (voir docs/suivi-sport.md §8).
export function streakWeeks(activites, todayDateStr, goalMin) {
  const g = Number(goalMin) || 0
  if (g <= 0) return 0
  const byWeek = statsByWeek(activites)
  let ws = weekStart(todayDateStr)
  if ((byWeek[ws]?.minutes || 0) < g) ws = addWeeks(ws, -1)
  let n = 0
  while ((byWeek[ws]?.minutes || 0) >= g) { n++; ws = addWeeks(ws, -1) }
  return n
}

// ── Bilan énergétique du jour (Palier 6 — LECTURE SEULE) ───────────────────
// Ne modifie AUCUN objectif. `maintenanceKcal` = dépense d'entretien estimée
// (TDEE), qui intègre déjà une part d'activité habituelle : d'où le garde-fou
// d'affichage « ne pas cumuler » côté UI. Renvoie null si on n'a pas de
// maintenance estimée (profil incomplet).
export function dayEnergyBalance({ consumedKcal, maintenanceKcal, sportKcal } = {}) {
  const maint = Number(maintenanceKcal) || 0
  if (maint <= 0) return null
  const cons = Number(consumedKcal) || 0
  const sport = Math.max(0, Number(sportKcal) || 0)
  const depense = maint + sport
  return {
    maintenance: Math.round(maint),
    sport: Math.round(sport),
    depense: Math.round(depense),
    bilan: Math.round(cons - depense), // > 0 = surplus, < 0 = déficit
  }
}

// Agrège une liste de séances (chacune { date, duree_min, energie_kcal }) sur
// la semaine contenant `anyDateInWeek`.
export function weeklyStats(activites, anyDateInWeek) {
  const list = (activites || []).filter(a => isInWeek(a.date, anyDateInWeek))
  return {
    minutes: list.reduce((s, a) => s + (Number(a.duree_min) || 0), 0),
    seances: list.length,
    kcal: list.reduce((s, a) => s + (Number(a.energie_kcal) || 0), 0),
  }
}

// ── Affichage ──────────────────────────────────────────────────────────────
// 45 → « 45 min » ; 95 → « 1 h 35 » ; 120 → « 2 h ».
export function formatDuree(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`
}

// '13:30:00' ou '13:30' → '13:30' ; vide → null.
export function formatHeure(t) {
  if (!t) return null
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// Tri d'affichage des séances d'un jour : par heure de début (les sans-heure
// en dernier), puis par date de création.
export function sortActivites(list) {
  return [...(list || [])].sort((a, b) => {
    const ha = a.heure_debut || '99:99'
    const hb = b.heure_debut || '99:99'
    if (ha !== hb) return ha < hb ? -1 : 1
    return (a.created_at || '') < (b.created_at || '') ? -1 : 1
  })
}
