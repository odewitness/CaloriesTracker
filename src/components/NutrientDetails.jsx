import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SUGAR_FIELDS, FAT_FIELDS, SUCRES_ANSES_REF } from '../lib/nutrients'

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

function SucresAnsesGauge({ totals, hasEntries }) {
  const sucresTotal = totals.sucres ?? 0
  const lactose = totals.lactose ?? 0
  const galactose = totals.galactose ?? 0
  const pertinent = Math.max(0, sucresTotal - lactose - galactose)
  const pct = Math.round((pertinent / SUCRES_ANSES_REF) * 100)
  const barPct = hasEntries ? Math.min(100, pct) : 0
  const excess = hasEntries && pertinent >= SUCRES_ANSES_REF
  const color = excess ? 'var(--coral)' : pct >= 80 ? 'var(--amber)' : '#1D9E75'

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--gray-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Sucres (recommandation Anses)</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: hasEntries ? color : 'var(--text-hint)' }}>
          {hasEntries ? `${excess ? '⚠︎ ' : ''}${pertinent.toFixed(1)} / ${SUCRES_ANSES_REF} g` : 'N/D'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Sucres totaux hors lactose et galactose · max recommandé 100 g/j
      </div>
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
            ? (
              <>
                <SucresAnsesGauge totals={totals} hasEntries={hasEntries} />
                <NutrientList fields={SUGAR_FIELDS} totals={totals} hasEntries={hasEntries} />
              </>
            )
            : <NutrientList fields={FAT_FIELDS} totals={totals} hasEntries={hasEntries} />}

        </div>
      )}
    </div>
  )
}