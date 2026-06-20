import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const VITAMINS = [
  { key: 'vit_c',    label: 'Vitamine C',  ref: 110,   unit: 'mg',  color: 'var(--green)' },
  { key: 'vit_d',    label: 'Vitamine D',  ref: 15,   unit: 'µg',  color: 'var(--amber)' },
  { key: 'vit_b12',  label: 'Vitamine B12',ref: 4,  unit: 'µg',  color: 'var(--purple)' },
  { key: 'vit_a',    label: 'Vitamine A',  ref: 650,  unit: 'µg',  color: 'var(--coral)' },
  { key: 'vit_e',    label: 'Vitamine E',  ref: 9,   unit: 'mg',  color: 'var(--blue)' },
  { key: 'calcium',  label: 'Calcium',     ref: 950, unit: 'mg',  color: 'var(--blue)' },
  { key: 'fer',      label: 'Fer',         ref: 16,   unit: 'mg',  color: 'var(--coral)' },
  { key: 'magnesium',label: 'Magnésium',   ref: 300,  unit: 'mg',  color: 'var(--green)' },
  { key: 'potassium',label: 'Potassium',   ref: 3500, unit: 'mg',  color: 'var(--amber)' },
]

export default function VitaminPanel({ totals }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Vitamines & Minéraux</span>
        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          {VITAMINS.map(v => {
            const val = totals[v.key] || 0
            const pct = Math.round((val / v.ref) * 100)
            const barPct = Math.min(100, pct)
            const badge = pct > 150 ? 'var(--coral)' : pct >= 100 ? '#1D9E75' : pct >= 50 ? 'var(--amber)' : 'var(--coral)'
            return (
              <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 12, color: 'var(--text)', width: 90, flexShrink: 0 }}>{v.label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: v.color, borderRadius: 3, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: badge, width: 34, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}