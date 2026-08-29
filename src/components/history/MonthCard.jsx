import React from 'react'
import { dayStatus, STATUS_COLOR } from '../../lib/history'

// Carte d'un mois dans le détail de l'onglet Année. `id` / `highlight` : cible
// de scroll et halo depuis le point correspondant de la courbe de tendance.
export default function MonthCard({ monthKey, monthLabel, avgKcal, daysLogged, goalKcal, highlight }) {
  const diff = Math.round(avgKcal - goalKcal)
  const color = STATUS_COLOR[dayStatus(avgKcal, goalKcal)] || 'var(--green)'
  return (
    <div
      id={`hist-month-${monthKey}`}
      className="card"
      style={{
        padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        outline: highlight ? '2px solid var(--green)' : '2px solid transparent',
        transition: 'outline-color .3s',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{daysLogged} jour{daysLogged > 1 ? 's' : ''} loggé{daysLogged > 1 ? 's' : ''}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round(avgKcal)} kcal/j</div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{diff <= 0 ? `−${Math.abs(diff)}` : `+${diff}`} vs objectif</div>
      </div>
    </div>
  )
}
