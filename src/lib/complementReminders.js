// ─────────────────────────────────────────────────────────────────────────────
// Rappels de compléments alimentaires — helpers partagés.
//
// Le rappel est stocké tel quel dans aliments_custom.rappel (jsonb), pour les
// aliments de catégorie « Compléments alimentaires » uniquement. Forme :
//   { enabled, heures: number[] (0-23), jours: number[] (0=lun..6=dim),
//     stop_si_pris: bool }
// jours vide/absent = tous les jours. Délivré par l'Edge Function
// complements-reminder (cron horaire, gate Europe/Paris) — d'où des heures
// entières (pas de minutes).
// ─────────────────────────────────────────────────────────────────────────────

export const REMINDER_DEFAULTS = {
  enabled: false,
  heures: [8],
  jours: [],          // [] = tous les jours
  stop_si_pris: true,
}

// 0 = lundi … 6 = dimanche (même convention que WEEKDAYS de CalendarMonthGrid).
export const WEEKDAY_LABELS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']

export const hLabel = (h) => `${String(h).padStart(2, '0')}:00`

// Normalise un `rappel` brut (venu de la base, potentiellement partiel/null).
export function mergeReminder(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const heures = Array.isArray(r.heures)
    ? [...new Set(r.heures.map(Number).filter(h => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b)
    : []
  const jours = Array.isArray(r.jours)
    ? [...new Set(r.jours.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : []
  return {
    enabled: !!r.enabled,
    heures: heures.length ? heures : [...REMINDER_DEFAULTS.heures],
    jours,
    stop_si_pris: r.stop_si_pris !== false,
  }
}

// "08:00 et 21:00 · tous les jours" / "08:00 · lun, mer, ven"
export function describeReminder(raw) {
  const r = mergeReminder(raw)
  if (!r.enabled) return 'Aucun rappel'
  const heures = r.heures.map(hLabel)
  const heurePart = heures.length <= 1
    ? (heures[0] || '')
    : heures.slice(0, -1).join(', ') + ' et ' + heures[heures.length - 1]
  const joursPart = r.jours.length === 0 || r.jours.length === 7
    ? 'tous les jours'
    : r.jours.map(d => WEEKDAY_LABELS[d]).join(', ')
  return `${heurePart} · ${joursPart}`
}
