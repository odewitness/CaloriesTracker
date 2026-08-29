import React from 'react'
import { Flame, Target, CalendarCheck, Scale, Trophy, Activity } from 'lucide-react'
import { EST_KCAL_PER_G } from '../../lib/history'

function fmtBalanceGrams(kcal) {
  const g = kcal / EST_KCAL_PER_G
  const abs = Math.abs(g)
  if (Math.round(abs) === 0) return '0 g'
  const sign = g > 0 ? '+' : '−'
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)} kg`
  return `${sign}${Math.round(abs)} g`
}

// Grille des 6 indicateurs clés de la période affichée + légende de calcul.
export default function HistoryStatGrid({
  avgKcal, deltaPrev, daysObjectif, daysCounted, daysWithData, periodDays,
  energyBalance, streak, recordStreak,
}) {
  const deltaTxt = deltaPrev == null || !isFinite(deltaPrev) || Math.round(deltaPrev) === 0
    ? null
    : `${deltaPrev > 0 ? '▲ +' : '▼ −'}${Math.abs(Math.round(deltaPrev))} vs préc.`
  const objPct = daysCounted ? Math.round((daysObjectif / daysCounted) * 100) : 0
  const followPct = periodDays ? Math.round((daysWithData / periodDays) * 100) : 0
  const balColor = energyBalance <= 0 ? 'var(--green)' : 'var(--coral)'

  const cards = [
    { icon: <Flame size={16} />, color: 'var(--amber)', val: Math.round(avgKcal || 0), label: 'Moy. kcal/j', sub: deltaTxt },
    { icon: <Target size={16} />, color: 'var(--green)', val: `${daysObjectif}/${daysCounted}`, label: 'Jours dans l’objectif', sub: `${objPct} %` },
    { icon: <CalendarCheck size={16} />, color: 'var(--blue)', val: `${daysWithData}/${periodDays}`, label: 'Jours loggés', sub: `${followPct} %` },
    { icon: <Scale size={16} />, color: balColor, val: fmtBalanceGrams(energyBalance), label: 'Bilan vs objectif', sub: `${energyBalance > 0 ? '+' : '−'}${Math.abs(Math.round(energyBalance))} kcal` },
    { icon: <Activity size={16} />, color: 'var(--purple)', val: `${streak} j`, label: 'Série en cours' },
    { icon: <Trophy size={16} />, color: 'var(--amber)', val: `${recordStreak} j`, label: 'Record de série' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
      {cards.map(c => (
        <div key={c.label} className="card" style={{ padding: '12px 12px', textAlign: 'center' }}>
          <div style={{ color: c.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.val}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{c.label}</div>
          {c.sub && <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 2, fontWeight: 600 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}
