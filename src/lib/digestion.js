// ─────────────────────────────────────────────────────────────────────────────
// digestion.js — helpers purs pour l'onglet « Digestion » de l'Historique
// (voir src/components/history/DigestionSection.jsx). Consomme les passages
// de la table `selles` (src/lib/stool.js) sur une période donnée.
//
// Même esprit que src/lib/history.js : fonctions pures, dates 'YYYY-MM-DD',
// pas d'accès réseau ici (fait par useSellesRange, src/hooks/useSelles.js).
// ─────────────────────────────────────────────────────────────────────────────
import { BRISTOL_TYPES, STOOL_REMARQUES, DIGESTIVE_SYMPTOMS, STOOL_SYMPTOM_REMARQUES } from './stool'

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

// ── Symptômes sans passage (table `symptomes_digestifs`, FODMAP Palier 4) ───
export function symptomStats(symptoms, periodDayKeys) {
  if (!symptoms.length) return null
  const counts = Object.fromEntries(DIGESTIVE_SYMPTOMS.map((s) => [s.key, 0]))
  for (const ep of symptoms) for (const k of ep.symptomes || []) if (counts[k] != null) counts[k]++
  const intensities = symptoms.map((s) => s.intensite).filter((v) => v != null)
  const daysWith = new Set(symptoms.map((s) => s.date)).size
  return {
    episodes: symptoms.length,
    daysWith,
    pctDays: periodDayKeys.length ? Math.round((daysWith / periodDayKeys.length) * 100) : null,
    meanIntensity: intensities.length ? mean(intensities) : null,
    counts: DIGESTIVE_SYMPTOMS.map((s) => ({ ...s, count: counts[s.key] })).filter((s) => s.count > 0),
  }
}

// Jours où au moins un symptôme digestif a été noté : épisode sans passage,
// ou passage avec la remarque « douleur » / « ballonnement ».
export function symptomDates(symptoms, selles) {
  const set = new Set(symptoms.map((s) => s.date))
  for (const s of selles) {
    if ((s.remarques || []).some((r) => STOOL_SYMPTOM_REMARQUES.includes(r))) set.add(s.date)
  }
  return set
}

export function nextDayKey(d) {
  const t = new Date(d + 'T12:00:00')
  t.setDate(t.getDate() + 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// ── FODMAP & transit (Palier 4) ─────────────────────────────────────────────
// Compare les jours « chargés » (au moins un repas modéré ou élevé en FODMAP,
// toutes familles ou une seule — voir usePeriodFodmap) aux autres jours où
// l'alimentation est notée, sur le type Bristol et les symptômes, le jour
// même (J) et le lendemain (J+1) : l'effet osmotique se fait en quelques
// heures, la fermentation sur plusieurs heures, souvent jusqu'au lendemain.
//
// fodmapByDate : { date: { any, groups } } ; key : 'any' ou clé de famille.
// Chaque comparaison exige au moins 2 jours de chaque côté (même garde-fou
// que bucketDaysByMetric) ; les symptômes ne sont comparés que si au moins un
// symptôme a été noté sur la période (sinon « 0 % vs 0 % » ne dit rien).
export function fodmapTransitStats({ fodmapByDate, key, selles, symptomDays, periodDayKeys }) {
  const inPeriod = new Set(periodDayKeys)
  const sellesByDate = {}
  for (const s of selles) (sellesByDate[s.date] ||= []).push(s)
  const days = periodDayKeys.filter((d) => fodmapByDate[d])
  const isLoaded = (d) => (key === 'any' ? fodmapByDate[d].any : !!fodmapByDate[d].groups[key])

  const compare = (valueFn) => {
    const a = [], b = []
    for (const d of days) {
      const v = valueFn(d)
      if (v == null) continue
      ;(isLoaded(d) ? a : b).push(v)
    }
    if (a.length < 2 || b.length < 2) return null
    return { meanA: mean(a), meanB: mean(b), nA: a.length, nB: b.length }
  }
  const bristolOn = (d) => (sellesByDate[d]?.length ? bristolMean(sellesByDate[d]) : null)
  const trackSymptoms = symptomDays.size > 0
  const symptomOn = (d) => (trackSymptoms && inPeriod.has(d) ? (symptomDays.has(d) ? 1 : 0) : null)

  const out = {
    bristolJ: compare((d) => bristolOn(d)),
    bristolJ1: compare((d) => bristolOn(nextDayKey(d))),
    symptomJ: compare((d) => symptomOn(d)),
    symptomJ1: compare((d) => symptomOn(nextDayKey(d))),
    nLoaded: days.filter(isLoaded).length,
    nOther: days.filter((d) => !isLoaded(d)).length,
  }
  if (!out.bristolJ && !out.bristolJ1 && !out.symptomJ && !out.symptomJ1) return null
  return out
}

// Part des jours chargés / des autres jours tombant en phase lutéale — pour
// garder le cycle en regard (la progestérone ralentit aussi le transit).
export function fodmapLutealShare({ fodmapByDate, key, periodDayKeys, isLuteal }) {
  const days = periodDayKeys.filter((d) => fodmapByDate[d])
  const loaded = days.filter((d) => (key === 'any' ? fodmapByDate[d].any : !!fodmapByDate[d].groups[key]))
  const other = days.filter((d) => !loaded.includes(d))
  if (loaded.length < 2 || other.length < 2) return null
  const pct = (list) => Math.round((list.filter(isLuteal).length / list.length) * 100)
  return { loaded: pct(loaded), other: pct(other) }
}
