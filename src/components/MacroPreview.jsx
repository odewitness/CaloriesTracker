import React from 'react'

export default function MacroPreview({ food, qty }) {
  const f = (parseFloat(qty) || 0) / 100
  const items = [
    { label: 'kcal', val: Math.round((food.energie_kcal || 0) * f), color: 'var(--text)' },
    { label: 'Prot.', val: `${((food.proteines || 0) * f).toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.', val: `${((food.glucides || 0) * f).toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',  val: `${((food.lipides || 0) * f).toFixed(1)}g`,  color: 'var(--coral)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
