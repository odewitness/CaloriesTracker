import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function MacroRow({ label, val, goal, color, unit }) {
  const pct = Math.min(100, (val / goal) * 100)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>{Math.round(val)}/{goal}{unit}</span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

// Carte combinée de la page du jour : cercle kcal (décalé à gauche) + macros
// empilées à droite + flèches de navigation jour précédent/suivant, pour
// gagner la place qu'occupaient l'ancien bandeau de date et l'encart macros
// séparé. Le swipe reste le moyen principal de changer de jour ; les flèches
// ici en sont juste une alternative tactile.
export default function TodayOverviewCard({ consumed, goal, prot, gluc, lip, fib, goals, onNavigate }) {
  const pct = Math.min(consumed / goal, 1)
  const R = 44
  const circ = 2 * Math.PI * R
  const offset = circ * (1 - pct)
  const remain = Math.max(0, goal - consumed)
  const over = consumed > goal

  const macros = [
    { label: 'Protéines', val: prot, goal: goals.goal_proteines, color: 'var(--green)', unit: 'g' },
    { label: 'Glucides',  val: gluc, goal: goals.goal_glucides,  color: 'var(--amber)', unit: 'g' },
    { label: 'Lipides',   val: lip,  goal: goals.goal_lipides,   color: 'var(--coral)', unit: 'g' },
    { label: 'Fibres',    val: fib,  goal: goals.goal_fibres,    color: 'var(--blue)',  unit: 'g' },
  ]

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 6px', marginBottom: 12 }}>
      <button className="btn-icon" onClick={() => onNavigate(-1)} aria-label="Jour précédent" style={{ flexShrink: 0 }}>
        <ChevronLeft size={20} color="var(--text-muted)" />
      </button>

      <div style={{ flexShrink: 0, textAlign: 'center', padding: '0 4px' }}>
        <div style={{ position: 'relative', width: 108, height: 108, margin: '0 auto' }}>
          <svg width="108" height="108" viewBox="0 0 108 108" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="54" cy="54" r={R} fill="none" stroke="var(--green-light)" strokeWidth="9" />
            <circle
              cx="54" cy="54" r={R} fill="none"
              stroke={over ? 'var(--coral)' : 'var(--green)'}
              strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset .5s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{Math.round(consumed)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>kcal</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: over ? 'var(--coral)' : 'var(--green)', marginTop: 6, whiteSpace: 'nowrap' }}>
          {over ? `+${Math.round(consumed - goal)} au-dessus` : `${Math.round(remain)} restantes`}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7, padding: '0 8px 0 4px' }}>
        {macros.map(m => <MacroRow key={m.label} {...m} />)}
      </div>

      <button className="btn-icon" onClick={() => onNavigate(1)} aria-label="Jour suivant" style={{ flexShrink: 0 }}>
        <ChevronRight size={20} color="var(--text-muted)" />
      </button>
    </div>
  )
}
