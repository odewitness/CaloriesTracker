import { useMemo } from 'react'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// useWeightProjection (roadmap §C4) — « à ce rythme, tu serais autour de X kg
// le [date] ». Régression linéaire (moindres carrés) sur les relevés de poids
// des dernières semaines, prolongée jusqu'à un horizon.
//
// On renvoie TOUJOURS une fourchette, jamais un point sec : le poids varie de
// jour en jour (eau, sel, cycle, digestion). La fourchette est l'intervalle de
// prédiction de la régression (erreur résiduelle propagée à l'horizon), donc
// elle s'élargit d'autant plus que les relevés sont bruités / rares / que
// l'horizon est lointain.
//
// Si la pente est trop faible pour être distinguée du bruit → `stable: true`
// et pas de projection chiffrée (on ne va pas agiter un chiffre anxiogène pour
// ce qui est du bruit de balance).
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 42     // ~6 semaines : assez pour une pente, assez récent
const MIN_POINTS = 4
const MIN_SPAN_DAYS = 14
const STABLE_WEEK_KG = 0.06   // < ~60 g/sem : on considère le poids stable
const DEFAULT_HORIZON_DAYS = 56  // ~2 mois

// t de Student ~95 % à deux queues, par degrés de liberté (n − 2). Petit
// barème figé : inutile d'importer une lib stats pour ça.
function tCrit(df) {
  const table = { 1: 12.71, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 12: 2.18, 15: 2.13, 20: 2.09, 30: 2.04 }
  if (df <= 10) return table[df] ?? 2.23
  if (df <= 12) return table[12]
  if (df <= 15) return table[15]
  if (df <= 20) return table[20]
  if (df <= 30) return table[30]
  return 1.96
}

function daysBetween(aStr, bStr) {
  return Math.round((new Date(bStr + 'T12:00:00') - new Date(aStr + 'T12:00:00')) / 86400000)
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

// `windowDays` (optionnel, défaut 42 = ~6 semaines) : fenêtre de relevés
// prise en compte pour la régression. Paramétrable pour que useGoalAdjustment
// et GoalWeightCard (chantier « Objectif de poids ») puissent élargir la
// fenêtre à un cycle complet quand le suivi du cycle est actif, TOUT EN
// PARTAGEANT la même régression — évite que les deux calculent chacun leur
// tendance et affichent des chiffres différents pour le même poids réel
// (retour utilisatrice du 2026-09-05).
export function useWeightProjection(measurementEntries, horizonDays = DEFAULT_HORIZON_DAYS, windowDays = WINDOW_DAYS) {
  const today = fmt(new Date())

  return useMemo(() => {
    const none = (reason) => ({ ok: false, reason })

    const cutoff = fmt(new Date(Date.now() - windowDays * 86400000))
    const pts = (measurementEntries || [])
      .filter(e => e.poids_kg != null && e.date >= cutoff && e.date <= today)
      .map(e => ({ date: e.date, y: Number(e.poids_kg) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (pts.length < MIN_POINTS) return none('pas-assez-de-releves')

    const spanDays = daysBetween(pts[0].date, pts[pts.length - 1].date)
    if (spanDays < MIN_SPAN_DAYS) return none('periode-trop-courte')

    // x = jours depuis le premier point de la fenêtre.
    const xs = pts.map(p => daysBetween(pts[0].date, p.date))
    const ys = pts.map(p => p.y)
    const n = pts.length
    const xbar = xs.reduce((s, v) => s + v, 0) / n
    const ybar = ys.reduce((s, v) => s + v, 0) / n

    let sxx = 0, sxy = 0
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - xbar) ** 2
      sxy += (xs[i] - xbar) * (ys[i] - ybar)
    }
    if (sxx === 0) return none('releves-le-meme-jour')

    const slope = sxy / sxx            // kg / jour
    const intercept = ybar - slope * xbar
    const fit = (x) => intercept + slope * x

    // Erreur-type résiduelle de la régression.
    let sse = 0
    for (let i = 0; i < n; i++) sse += (ys[i] - fit(xs[i])) ** 2
    const s = Math.sqrt(sse / (n - 2))
    const t = tCrit(n - 2)

    const todayX = daysBetween(pts[0].date, today)
    const horizonX = todayX + horizonDays
    const targetDate = addDaysStr(today, horizonDays)

    const currentTrendKg = Math.round(fit(todayX) * 10) / 10
    const trendWeekKg = slope * 7
    const trendMonthKg = slope * 30

    // Intervalle de prédiction à l'horizon (nouvelle observation, pas moyenne).
    const sePred = s * Math.sqrt(1 + 1 / n + (horizonX - xbar) ** 2 / sxx)
    const margin = t * sePred

    const predicted = fit(horizonX)
    const round1 = (v) => Math.round(v * 10) / 10

    const stable = Math.abs(trendWeekKg) < STABLE_WEEK_KG

    return {
      ok: true,
      stable,
      direction: slope > 0 ? 'hausse' : slope < 0 ? 'baisse' : 'stable',
      nPoints: n,
      spanDays,
      firstDate: pts[0].date,
      lastDate: pts[pts.length - 1].date,
      horizonDays,
      targetDate,
      currentTrendKg,
      latestWeightKg: ys[n - 1],
      trendWeekKg: round1(trendWeekKg),
      trendMonthKg: round1(trendMonthKg),
      predictedKg: round1(predicted),
      lowKg: round1(predicted - margin),
      highKg: round1(predicted + margin),
    }
  }, [measurementEntries, horizonDays, windowDays, today])
}
