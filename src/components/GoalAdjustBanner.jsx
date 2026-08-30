import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// GoalAdjustBanner (roadmap §M3) — proposition d'ajustement de l'objectif
// calorique, à partir de la tendance réelle du poids. L'utilisatrice valide
// ou reporte ; rien ne change sans son accord. Affiché seulement sur la page
// du jour "aujourd'hui", au plus une fois par semaine (throttle côté hook).
// ─────────────────────────────────────────────────────────────────────────────
function paceLabel(kgWeek) {
  const v = Math.abs(kgWeek)
  if (v < 0.05) return 'stable'
  const sign = kgWeek < 0 ? '−' : '+'
  return `${sign}${v.toFixed(1).replace('.', ',')} kg/sem`
}

export default function GoalAdjustBanner({ suggestion, onApply, onDismiss }) {
  if (!suggestion) return null
  const { currentGoal, newGoal, diff, observedKgWeek, intendedKgWeek, spanDays } = suggestion
  const down = diff < 0
  const Icon = down ? TrendingDown : TrendingUp
  const weeks = Math.round(spanDays / 7)

  return (
    <div
      className="card"
      style={{ padding: '14px 16px', marginBottom: 16, borderLeft: '3px solid var(--green)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color="var(--green)" />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Objectif calorique</span>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Sur ~{weeks} semaine{weeks > 1 ? 's' : ''}, ton poids évolue à{' '}
        <strong style={{ color: 'var(--text)' }}>{paceLabel(observedKgWeek)}</strong>. Ton objectif
        actuel ({currentGoal} kcal) vise plutôt{' '}
        <strong style={{ color: 'var(--text)' }}>{paceLabel(intendedKgWeek)}</strong>.
        {' '}
        {down
          ? `Réduire l'objectif à ${newGoal} kcal (${diff}) pour t'en rapprocher ?`
          : `Remonter l'objectif à ${newGoal} kcal (+${diff}) pour t'en rapprocher ?`}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn-primary"
          onClick={onApply}
          style={{ flex: 1, padding: '9px 12px', fontSize: 13 }}
        >
          Appliquer
        </button>
        <button
          className="btn-ghost"
          onClick={onDismiss}
          style={{ flex: 1, padding: '9px 12px', fontSize: 13, textAlign: 'center' }}
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
