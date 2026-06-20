import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const VITAMINS = [
  { key: 'vit_c',     label: 'Vitamine C',   ref: 110,   lss: null,  unit: 'mg',  color: 'var(--green)'  },
  { key: 'vit_d',     label: 'Vitamine D',   ref: 15,    lss: 100,   unit: 'µg',  color: 'var(--amber)'  },
  { key: 'vit_b12',   label: 'Vitamine B12', ref: 4,     lss: null,  unit: 'µg',  color: 'var(--purple)' },
  { key: 'vit_a',     label: 'Vitamine A',   ref: 650,   lss: 3000,  unit: 'µg',  color: 'var(--coral)'  },
  { key: 'vit_e',     label: 'Vitamine E',   ref: 9,     lss: 300,   unit: 'mg',  color: 'var(--blue)'   },
  { key: 'calcium',   label: 'Calcium',      ref: 950,   lss: 2500,  unit: 'mg',  color: 'var(--blue)'   },
  { key: 'fer',       label: 'Fer',          ref: 16,    lss: 40,    unit: 'mg',  color: 'var(--coral)'  },
  { key: 'magnesium', label: 'Magnésium',    ref: 300,   lss: 2500,  unit: 'mg',  color: 'var(--green)'  },
  { key: 'potassium', label: 'Potassium',    ref: 3500,  lss: null,  unit: 'mg',  color: 'var(--amber)'  },
]

function getStatus(val, ref, lss) {
  if (lss !== null && val >= lss) return 'excess'
  if (val >= ref)                  return 'ok'
  if (val >= ref * 0.5)            return 'mid'
  return 'low'
}

const STATUS_COLOR = {
  excess: 'var(--coral)',
  ok:     '#1D9E75',
  mid:    'var(--amber)',
  low:    'var(--coral)',
}

export default function VitaminPanel({ totals, hasEntries }) {
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
            const val = totals[v.key] ?? 0

            // N/D uniquement si aucune entrée dans le journal du jour —
            // une valeur à 0 sur un aliment loggé est une vraie donnée (aliment non source de ce nutriment)
            const hasData = hasEntries

            const pct = Math.round((val / v.ref) * 100)
            const barPct = Math.min(100, pct)

            const lssMarkerPct = v.lss !== null
              ? Math.min(100, (v.lss / v.ref) * 100)
              : null

            const status = hasData ? getStatus(val, v.ref, v.lss) : 'low'
            const barColor = status === 'excess' ? 'var(--coral)' : v.color
            const badgeColor = STATUS_COLOR[status]

            const tooltip = hasData
              ? `${val.toFixed(val < 1 ? 3 : 1)} ${v.unit} / RNP ${v.ref} ${v.unit}${v.lss ? ` / LSS ${v.lss} ${v.unit}` : ''}`
              : 'Données non disponibles'

            return (
              <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }} title={tooltip}>
                <span style={{ fontSize: 12, color: 'var(--text)', width: 90, flexShrink: 0 }}>{v.label}</span>

                <div style={{ flex: 1, position: 'relative', height: 6 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: hasData ? `${barPct}%` : '0%',
                      height: '100%',
                      background: STATUS_COLOR[status],
                      borderRadius: 3,
                      transition: 'width .4s',
                    }} />
                  </div>

                  {lssMarkerPct !== null && lssMarkerPct < 100 && (
                    <div style={{
                      position: 'absolute',
                      top: -1,
                      bottom: -1,
                      left: `${lssMarkerPct}%`,
                      width: 2,
                      background: 'var(--coral)',
                      borderRadius: 1,
                      opacity: 0.55,
                      transform: 'translateX(-50%)',
                    }} />
                  )}
                </div>

                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: hasData ? badgeColor : 'var(--text-hint)',
                  width: 38,
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {hasData ? `${status === 'excess' ? '⚠︎ ' : ''}${pct}%` : 'N/D'}
                </span>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 2, height: 10, background: 'var(--coral)', borderRadius: 1, opacity: 0.55 }} />
              <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>LSS</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>
              <span style={{ color: '#1D9E75', fontWeight: 600 }}>vert</span> ≥ RNP &nbsp;·&nbsp;
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>orange</span> 50–99 % &nbsp;·&nbsp;
              <span style={{ color: 'var(--coral)', fontWeight: 600 }}>rouge</span> &lt; 50 % ou ≥ LSS
            </span>
          </div>
        </div>
      )}
    </div>
  )
}