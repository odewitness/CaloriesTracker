// ─────────────────────────────────────────────────────────────────────────────
// digestion.js — helpers purs pour l'onglet « Digestion » de l'Historique
// (voir src/components/history/DigestionSection.jsx). Consomme les passages
// de la table `selles` (src/lib/stool.js) sur une période donnée.
//
// Même esprit que src/lib/history.js : fonctions pures, dates 'YYYY-MM-DD',
// pas d'accès réseau ici (fait par useSellesRange, src/hooks/useSelles.js).
// ─────────────────────────────────────────────────────────────────────────────
import { BRISTOL_TYPES, STOOL_REMARQUES } from './stool'

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)

// ── Fréquence & régularité ──────────────────────────────────────────────────
// periodDayKeys : jours calendaires de la période (eachDay), déjà bornés à
// aujourd'hui pour la période courante — même construction que `periodDays`
// dans HistoryPage.
export function regularityStats(selles, periodDayKeys) {
  if (!periodDayKeys.length || !selles.length) return null
  const distinctDates = [...new Set(selles.map((s) => s.date))].sort()
  const daysWithStool = distinctDates.length
  const periodDays = periodDayKeys.length

  const gaps = []
  for (let i = 1; i < distinctDates.length; i++) {
    const a = new Date(distinctDates[i - 1] + 'T12:00:00')
    const b = new Date(distinctDates[i] + 'T12:00:00')
    gaps.push(Math.round((b - a) / 86400000))
  }
  const meanGap = gaps.length ? mean(gaps) : null
  const stdGap = gaps.length
    ? Math.sqrt(mean(gaps.map((g) => (g - meanGap) ** 2)))
    : null

  return {
    total: selles.length,
    daysWithStool,
    periodDays,
    pctDaysWithout: Math.round((1 - daysWithStool / periodDays) * 100),
    perDay: selles.length / periodDays,
    meanGap,
    stdGap,
    longestGap: gaps.length ? Math.max(...gaps) : null,
  }
}

// ── Distribution Bristol ────────────────────────────────────────────────────
export function bristolHistogram(selles) {
  const counts = Object.fromEntries(BRISTOL_TYPES.map((t) => [t.value, 0]))
  for (const s of selles) if (counts[s.bristol] != null) counts[s.bristol]++
  return BRISTOL_TYPES.map((t) => ({ ...t, count: counts[t.value] }))
}

export function bristolMean(selles) {
  const vals = selles.map((s) => s.bristol).filter((v) => v != null)
  return vals.length ? mean(vals) : null
}

// ── Effort & évacuation ─────────────────────────────────────────────────────
export function effortStats(selles) {
  const withEffort = selles.filter((s) => s.effort)
  const withComplete = selles.filter((s) => s.evacuation_complete != null)
  if (!withEffort.length && !withComplete.length) return null
  return {
    nEffort: withEffort.length,
    pctDifficile: withEffort.length
      ? Math.round((withEffort.filter((s) => s.effort === 'difficile').length / withEffort.length) * 100)
      : null,
    nComplete: withComplete.length,
    pctIncomplete: withComplete.length
      ? Math.round((withComplete.filter((s) => s.evacuation_complete === false).length / withComplete.length) * 100)
      : null,
  }
}

// ── Remarques & alertes ─────────────────────────────────────────────────────
// Signaux à ne pas noyer dans une moyenne : sang / mucus. Retourne les
// passages concernés, du plus récent au plus ancien.
const ALERT_KEYS = ['sang', 'mucus']
export function alertEntries(selles) {
  return selles
    .filter((s) => (s.remarques || []).some((r) => ALERT_KEYS.includes(r)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function remarqueCounts(selles) {
  const counts = Object.fromEntries(STOOL_REMARQUES.map((r) => [r.key, 0]))
  for (const s of selles) for (const r of s.remarques || []) if (counts[r] != null) counts[r]++
  return STOOL_REMARQUES.map((r) => ({ ...r, count: counts[r.key] })).filter((r) => r.count > 0)
}

// ── Corrélations « jours A vs jours B » ─────────────────────────────────────
// Même principe que sportPeriodStats/cyclePhaseStats dans HistoryPage : split
// des jours en deux groupes, comparaison de moyennes, garde-fou n≥2 par
// groupe. `metricFn` réduit les passages d'un jour à une valeur (ex. type
// Bristol moyen du jour) ; `isBucketA` classe une date dans le groupe A.
export function bucketDaysByMetric(selles, dayKeys, isBucketA, metricFn) {
  const byDate = {}
  for (const s of selles) (byDate[s.date] ||= []).push(s)
  const a = [], b = []
  for (const d of dayKeys) {
    const dayEntries = byDate[d]
    if (!dayEntries?.length) continue
    const m = metricFn(dayEntries)
    if (m == null) continue
    ;(isBucketA(d) ? a : b).push(m)
  }
  if (a.length < 2 || b.length < 2) return null
  const meanA = mean(a), meanB = mean(b)
  return { meanA, meanB, delta: meanA - meanB, nA: a.length, nB: b.length }
}

export function dayMeanBristol(dayEntries) {
  return bristolMean(dayEntries)
}

export function dayDifficileRate(dayEntries) {
  const withEffort = dayEntries.filter((s) => s.effort)
  return withEffort.length ? withEffort.filter((s) => s.effort === 'difficile').length / withEffort.length : null
}

// Split médian d'une métrique quotidienne (ex. fibres du jour, ml d'eau bus) —
// sert à définir « jours élevés » vs « jours faibles » sans seuil arbitraire.
// Retourne null si trop peu de jours renseignés pour qu'un split ait un sens.
export function medianSplit(valueByDate) {
  const vals = Object.values(valueByDate).filter((v) => v != null && v > 0)
  if (vals.length < 4) return null
  const sorted = [...vals].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return { median, isHigh: (d) => (valueByDate[d] ?? 0) >= median }
}
