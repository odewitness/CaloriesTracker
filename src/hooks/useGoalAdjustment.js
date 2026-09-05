import { useMemo, useCallback } from 'react'
import { computeCalorieNeeds } from '../lib/nutrients'
import { requiredPaceKgPerWeek, goalKcalDeltaForPace, KCAL_PER_KG } from '../lib/poidsObjectif'
import { cycleInfo } from '../lib/cycle'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// useGoalAdjustment (roadmap §M3 ; Palier 2 du chantier « Objectif de poids »,
// voir docs/objectif-poids.md) — compare la tendance RÉELLE du poids
// (mensurations, ~3 dernières semaines) au rythme "visé", et propose — jamais
// n'impose — un petit ajustement de `goal_kcal` (±100 kcal max) si l'écart
// est net.
//
// Rythme "visé" : si un objectif de poids est renseigné (settings.poids_objectif,
// poids désiré + date visée, encore atteignable), on vise DIRECTEMENT ce
// rythme (requiredPaceKgPerWeek — même calcul que GoalWeightCard). Sinon on
// retombe sur l'ancien comportement, purement rétrocompatible : le rythme se
// déduit de l'écart goal_kcal/TDEE (deficit visé = TDEE − goal_kcal ; rythme
// visé ≈ −deficit×7/7700 kg/semaine). Marche aussi en "maintien" (goal ≈ TDEE
// → rythme visé ≈ 0 → on ramène vers la stabilité si le poids dérive).
//
// Opt-in : ne renvoie rien tant que settings.goal_auto_adjust.enabled est
// faux. Throttle : après un "Appliquer" ou un "Plus tard", on ne re-propose
// pas avant 7 jours (last_prompt).
//
// Correctif 2026-09-05 : la conversion rythme→kcal passe par
// `goalKcalDeltaForPace` (poidsObjectif.js), la MÊME formule que le bouton
// "Appliquer" de GoalWeightCard (juste plafonnée ±100/semaine ici) — évite
// que les deux proposent des nombres différents pour le même objectif
// (l'un basé sur la tendance réelle, l'autre sur une formule théorique).
//
// Palier 3 : quand le suivi du cycle est actif (hors contraception), la
// fenêtre d'observation exigée est élargie à au moins UN CYCLE COMPLET
// (longueur de cycle effective de cycleInfo — observée ou réglée) au lieu du
// minimum fixe de 14 jours. La rétention d'eau en phase lutéale (+0,5 à 2 kg,
// documentée chez la grande majorité des personnes réglées, voir
// docs/objectif-poids.md §2) peut fausser une pente mesurée sur une fenêtre
// plus courte qui ne couvrirait qu'un bout de cycle ; sur un cycle complet,
// ce bruit est présent au début ET à la fin de la fenêtre et s'annule.
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 28
const MIN_POINTS = 3
const MIN_SPAN_DAYS = 14
const MIN_GAP_KG_WEEK = 0.12   // en-dessous : trop proche, on ne dit rien
const MIN_DELTA_KCAL = 40      // en-dessous : pas la peine de proposer
const MAX_DELTA_KCAL = 100     // pas d'ajustement plus brutal par passe
const GOAL_FLOOR = 1200

function daysBetween(aStr, bStr) {
  return Math.round((new Date(bStr + 'T12:00:00') - new Date(aStr + 'T12:00:00')) / 86400000)
}

// Pente d'une régression linéaire (moindres carrés) : x en jours, y en kg.
function slopeKgPerDay(points) {
  const n = points.length
  const x0 = points[0].x
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (const p of points) {
    const x = p.x - x0
    sx += x; sy += p.y; sxx += x * x; sxy += x * p.y
  }
  const denom = n * sxx - sx * sx
  if (denom === 0) return 0
  return (n * sxy - sx * sy) / denom
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function useGoalAdjustment({ profile, measurementEntries, settings, updateSettings, cycleDays }) {
  const cfg = settings?.goal_auto_adjust
  const today = fmt(new Date())

  const suggestion = useMemo(() => {
    if (!cfg?.enabled) return null
    if (cfg.last_prompt && daysBetween(cfg.last_prompt, today) < 7) return null

    const currentGoal = settings?.goal_kcal
    if (!currentGoal) return null

    // Fenêtre requise : un cycle complet si le suivi est actif et qu'on
    // connaît sa longueur effective, sinon le minimum par défaut.
    const cycleActive = settings?.cycle?.enabled && !settings?.cycle?.sous_contraception
    const info = cycleActive ? cycleInfo(today, cycleDays, settings.cycle) : null
    const cycleLen = info?.predictedLen || null
    const minSpanDays = cycleLen ? Math.max(MIN_SPAN_DAYS, cycleLen) : MIN_SPAN_DAYS
    const windowDays = cycleLen ? Math.max(WINDOW_DAYS, cycleLen + 3) : WINDOW_DAYS

    // Points de poids sur la fenêtre, triés par date croissante.
    const cutoff = fmt(new Date(Date.now() - windowDays * 86400000))
    const pts = (measurementEntries || [])
      .filter(e => e.poids_kg != null && e.date >= cutoff)
      .map(e => ({ date: e.date, y: Number(e.poids_kg) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    if (pts.length < MIN_POINTS) return null
    const span = daysBetween(pts[0].date, pts[pts.length - 1].date)
    if (span < minSpanDays) return null

    const withX = pts.map(p => ({ x: daysBetween(pts[0].date, p.date), y: p.y }))
    const observedKgWeek = slopeKgPerDay(withX) * 7
    const latestWeight = pts[pts.length - 1].y

    // Rythme visé : en priorité l'objectif de poids réel (poids désiré + date
    // encore atteignable), sinon l'ancienne inférence depuis goal_kcal/TDEE.
    const goalWeight = settings?.poids_objectif
    const targetPace = requiredPaceKgPerWeek({
      poidsDesire: goalWeight?.poids_desire,
      dateObjectif: goalWeight?.date_objectif,
      trendKg: latestWeight,
      today,
    })

    let intendedKgWeek, source
    if (targetPace != null) {
      intendedKgWeek = targetPace
      source = 'poids_objectif'
    } else {
      const needs = computeCalorieNeeds({
        sexe: profile?.sexe, age: profile?.age, tailleCm: profile?.taille_cm,
        poidsKg: latestWeight, activityKey: profile?.niveau_activite,
      })
      if (!needs?.tdee) return null
      intendedKgWeek = -((needs.tdee - currentGoal) * 7) / KCAL_PER_KG
      source = 'goal_kcal'
    }

    const gapKgWeek = observedKgWeek - intendedKgWeek   // >0 : perd trop lentement / prend trop vite
    if (Math.abs(gapKgWeek) < MIN_GAP_KG_WEEK) return null

    const rawDelta = clamp(
      goalKcalDeltaForPace({ observedKgWeek, requiredKgWeek: intendedKgWeek }),
      -MAX_DELTA_KCAL, MAX_DELTA_KCAL,
    )
    if (Math.abs(rawDelta) < MIN_DELTA_KCAL) return null

    let newGoal = Math.round((currentGoal + rawDelta) / 10) * 10
    newGoal = Math.max(GOAL_FLOOR, newGoal)
    if (newGoal === currentGoal) return null

    return {
      currentGoal,
      newGoal,
      diff: newGoal - currentGoal,
      observedKgWeek: Math.round(observedKgWeek * 100) / 100,
      intendedKgWeek: Math.round(intendedKgWeek * 100) / 100,
      spanDays: span,
      source,
      poidsDesire: source === 'poids_objectif' ? goalWeight.poids_desire : null,
      dateObjectif: source === 'poids_objectif' ? goalWeight.date_objectif : null,
    }
  }, [
    cfg?.enabled, cfg?.last_prompt, today, settings?.goal_kcal, measurementEntries, profile,
    settings?.poids_objectif?.poids_desire, settings?.poids_objectif?.date_objectif,
    settings?.cycle, cycleDays,
  ])

  const markPrompted = useCallback((patch) => {
    updateSettings({ goal_auto_adjust: { ...cfg, enabled: true, last_prompt: today }, ...patch })
  }, [cfg, today, updateSettings])

  const apply = useCallback(() => {
    if (!suggestion) return
    markPrompted({ goal_kcal: suggestion.newGoal })
  }, [suggestion, markPrompted])

  const dismiss = useCallback(() => markPrompted(), [markPrompted])

  return { suggestion, apply, dismiss }
}
