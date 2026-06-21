import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SUGAR_FIELDS, FAT_FIELDS } from '../lib/nutrients'

function fmtVal(val, unit) {
  if (val == null) return '—'
  return `${val < 1 && val > 0 ? val.toFixed(2) : Math.round(val * 10) / 10} ${unit}`
}

function NutrientList({ fields, totals, hasEntries }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {fields.map(f => {
        const val = hasEntries ? (totals[f.key] ?? 0) : null
        return (
          <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text)' }}>{f.label}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{hasEntries ? fmtVal(val, f.unit) : 'N/D'}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function NutrientDetails({ totals, hasEntries }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('sucres') // sucres | gras

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Détail sucres & acides gras</span>
        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setTab('sucres')}
              className="chip"
              style={{ background: tab === 'sucres' ? 'var(--green)' : 'var(--green-light)', color: tab === 'sucres' ? 'white' : 'var(--green-dark)' }}
            >
              Sucres
            </button>
            <button
              onClick={() => setTab('gras')}
              className="chip"
              style={{ background: tab === 'gras' ? 'var(--green)' : 'var(--green-light)', color: tab === 'gras' ? 'white' : 'var(--green-dark)' }}
            >
              Acides gras
            </button>
          </div>

          {tab === 'sucres'
            ? <NutrientList fields={SUGAR_FIELDS} totals={totals} hasEntries={hasEntries} />
            : <NutrientList fields={FAT_FIELDS} totals={totals} hasEntries={hasEntries} />}

        </div>
      )}
    </div>
  )
}
