import React from 'react'

function Bar({ value, goal, color }) {
  const pct = Math.min(100, (value / goal) * 100)
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .4s' }} />
    </div>
  )
}

export default function MacroBar({ prot, gluc, lip, fib, goals }) {
  const items = [
    { label: 'Protéines', val: prot, goal: goals.goal_proteines, color: 'var(--green)', unit: 'g' },
    { label: 'Glucides',  val: gluc, goal: goals.goal_glucides,  color: 'var(--amber)', unit: 'g' },
    { label: 'Lipides',   val: lip,  goal: goals.goal_lipides,   color: 'var(--coral)', unit: 'g' },
    { label: 'Fibres',    val: fib,  goal: goals.goal_fibres,    color: 'var(--blue)',  unit: 'g' },
  ]
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {items.map(({ label, val, goal, color, unit }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{Math.round(val)}{unit}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>/ {goal}{unit}</div>
            <Bar value={val} goal={goal} color={color} />
          </div>
        ))}
      </div>
    </div>
  )
}
