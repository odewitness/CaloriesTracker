import React from 'react'

export default function CalorieRing({ consumed, goal }) {
  const pct = Math.min(consumed / goal, 1)
  const R = 54
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - pct)
  const remain = Math.max(0, goal - consumed)
  const over = consumed > goal

  return (
    <div className="card" style={{ padding: '20px 16px 18px', marginBottom: 12, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 14px' }}>
        <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="65" cy="65" r={R} fill="none" stroke="var(--green-light)" strokeWidth="10" />
          <circle
            cx="65" cy="65" r={R} fill="none"
            stroke={over ? 'var(--coral)' : 'var(--green)'}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset .5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{Math.round(consumed)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>kcal</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: over ? 'var(--coral)' : 'var(--green)' }}>
        {over ? `+${Math.round(consumed - goal)} kcal au-dessus` : `${Math.round(remain)} kcal restantes`}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 3 }}>Objectif : {goal} kcal</div>
    </div>
  )
}
