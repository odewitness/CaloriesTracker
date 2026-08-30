import { useMemo, useCallback } from 'react'
import { computeCalorieNeeds } from '../lib/nutrients'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// useGoalAdjustment (roadmap §M3) — compare la tendance RÉELLE du poids
// (mensurations, ~3 dernières semaines) au rythme que l'objectif calorique
// actuel est censé produire, et propose — jamais n'impose — un petit
// ajustement de `goal_kcal` (±100 kcal max) si l'écart est net.
//
// Le rythme "visé" n'a pas besoin d'être stocké : il se déduit de l'objectif
// lui-même. deficit visé = TDEE − goal_kcal ; rythme visé ≈ −deficit×7/7700
// kg/semaine (négatif = perte). Marche donc aussi en "maintien" (goal ≈ TDEE
// → rythme visé ≈ 0 → on ramène vers la stabilité si le poids dérive).
//
// Opt-in : ne renvoie rien tant que settings.goal_auto_adjust.enabled est
// faux. Throttle : après un "Appliquer" ou un "Plus tard", on ne re-propose
// pas avant 7 jours (last_prompt).
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 28
const MIN_POINTS = 3
const MIN_SPAN_DAYS = 14
const MIN_GAP_KG_WEEK = 0.12   // en-dessous : trop proche, on ne dit rien
const MIN_DELTA_KCAL = 40      // en-dessous : pas la peine de proposer
const MAX_DELTA_KCAL = 100     // pas d'ajustement plus brutal par passe
const KCAL_PER_KG = 7700
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

export function useGoalAdjustment({ profile, measurementEntries, settings, updateSettings }) {
  const cfg = settings?.goal_auto_adjust
  const today = fmt(new Date())

  const suggestion = useMemo(() => {
    if (!cfg?.enabled) return null
    if (cfg.last_prompt && daysBetween(cfg.last_prompt, today) < 7) return null

    const currentGoal = settings?.goal_kcal
    if (!currentGoal) return null

    // Points de poids sur la fenêtre, triés par date croissante.
    const cutoff = fmt(new Date(Date.now() - WINDOW_DAYS * 86400000))
    const pts = (measurementEntries || [])
      .filter(e => e.poids_kg != null && e.date >= cutoff)
      .map(e => ({ date: e.date, y: Number(e.poids_kg) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    if (pts.length < MIN_POINTS) return null
    const span = daysBetween(pts[0].date, pts[pts.length - 1].date)
    if (span < MIN_SPAN_DAYS) return null

    const withX = pts.map(p => ({ x: daysBetween(pts[0].date, p.date), y: p.y }))
    const observedKgWeek = slopeKgPerDay(withX) * 7
    const latestWeight = pts[pts.length - 1].y

    const needs = computeCalorieNeeds({
      sexe: profile?.sexe, age: profile?.age, tailleCm: profile?.taille_cm,
      poidsKg: latestWeight, activityKey: profile?.niveau_activite,
    })
    if (!needs?.tdee) return null

    const intendedKgWeek = -((needs.tdee - currentGoal) * 7) / KCAL_PER_KG
    const gap = observedKgWeek - intendedKgWeek   // >0 : perd trop lentement / prend trop vite
    if (Math.abs(gap) < MIN_GAP_KG_WEEK) return null

    const rawDelta = clamp((gap * KCAL_PER_KG) / 7, -MAX_DELTA_KCAL, MAX_DELTA_KCAL)
    if (Math.abs(rawDelta) < MIN_DELTA_KCAL) return null

    let newGoal = Math.round((currentGoal - rawDelta) / 10) * 10
    newGoal = Math.max(GOAL_FLOOR, newGoal)
    if (newGoal === currentGoal) return null

    return {
      currentGoal,
      newGoal,
      diff: newGoal - currentGoal,
      observedKgWeek: Math.round(observedKgWeek * 100) / 100,
      intendedKgWeek: Math.round(intendedKgWeek * 100) / 100,
      spanDays: span,
    }
  }, [cfg?.enabled, cfg?.last_prompt, today, settings?.goal_kcal, measurementEntries, profile])

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
