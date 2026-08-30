import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// WeightProjectionCard (roadmap §C4) — « à ce rythme, tu serais autour de X kg
// le [date] ». Prolonge la tendance des dernières semaines (voir
// useWeightProjection). Volontairement prudent : une fourchette, jamais un
// point sec, et un rappel que ce n'est qu'une projection de tendance.
// ─────────────────────────────────────────────────────────────────────────────

const n1 = (v) => v.toFixed(1).replace('.', ',')

function longDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function horizonLabel(days) {
  const months = Math.round(days / 30)
  if (months >= 2) return `dans ${months} mois`
  const weeks = Math.round(days / 7)
  return `dans ${weeks} semaines`
}

export default function WeightProjectionCard({ projection }) {
  if (!projection) return null

  // Pas assez de matière pour projeter quoi que ce soit — petit encouragement
  // discret plutôt qu'une carte vide.
  if (!projection.ok) {
    if (projection.reason === 'pas-assez-de-releves' || projection.reason === 'periode-trop-courte') {
      return (
        <div className="card" style={{ padding: '13px 16px', marginBottom: 16, fontSize: 12.5, color: 'var(--text-hint)', lineHeight: 1.5 }}>
          Avec quelques relevés de poids de plus (répartis sur au moins deux semaines),
          une projection de ta tendance s'affichera ici.
        </div>
      )
    }
    return null
  }

  const { stable, direction, spanDays, currentTrendKg, trendWeekKg, trendMonthKg,
    predictedKg, lowKg, highKg, targetDate, horizonDays } = projection
  const weeks = Math.round(spanDays / 7)
  const down = direction === 'baisse'
  const Icon = stable ? Minus : down ? TrendingDown : TrendingUp
  const accent = stable ? 'var(--text-muted)' : 'var(--green)'

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 16, borderLeft: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={accent} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Projection</span>
      </div>

      {stable ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Sur les <strong style={{ color: 'var(--text)' }}>{spanDays} derniers jours</strong>, ton
          poids est stable, autour de <strong style={{ color: 'var(--text)' }}>{n1(currentTrendKg)} kg</strong>.
          Aucune tendance nette à la hausse ou à la baisse pour l'instant — donc rien à projeter.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 27, fontWeight: 700, color: 'var(--green)', lineHeight: 1.1 }}>
            ≈ {n1(predictedKg)} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>kg</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 3 }}>
            {horizonLabel(horizonDays)} (vers le {longDate(targetDate)}), si la tendance des{' '}
            {weeks} dernières semaines se maintient
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
              fourchette {n1(lowKg)} – {n1(highKg)} kg
            </span>
            <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
              {down ? '−' : '+'}{n1(Math.abs(trendWeekKg))} kg/sem · {down ? '−' : '+'}{n1(Math.abs(trendMonthKg))} kg/mois
            </span>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.5 }}>
            Tendance actuelle : {n1(currentTrendKg)} kg aujourd'hui. Une projection n'est pas une
            prédiction : le poids bouge chaque jour (eau, sel, cycle, digestion). À lire comme une
            indication de cap, pas comme un verdict.
          </div>
        </>
      )}
    </div>
  )
}
