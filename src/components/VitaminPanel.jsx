import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const VITAMINS = [
  { key: 'vit_c',     label: 'Vitamine C',   ref: 110,   lss: 1000,  unit: 'mg',  color: 'var(--green)'  },
  { key: 'vit_d',     label: 'Vitamine D',   ref: 15,    lss: 100,   unit: 'µg',  color: 'var(--amber)'  },
  { key: 'vit_b12',   label: 'Vitamine B12', ref: 4,     lss: null,  unit: 'µg',  color: 'var(--purple)' },
  { key: 'vit_a',     label: 'Vitamine A',   ref: 650,   lss: 3000,  unit: 'µg',  color: 'var(--coral)'  },
  { key: 'vit_e',     label: 'Vitamine E',   ref: 9,     lss: 300,   unit: 'mg',  color: 'var(--blue)'   },
  { key: 'calcium',   label: 'Calcium',      ref: 950,   lss: 2500,  unit: 'mg',  color: 'var(--blue)'   },
  { key: 'fer',       label: 'Fer',          ref: 16,    lss: 40,    unit: 'mg',  color: 'var(--coral)'  },
  { key: 'magnesium', label: 'Magnésium',    ref: 300,   lss: 250,   unit: 'mg',  color: 'var(--green)'  },
  { key: 'potassium', label: 'Potassium',    ref: 3500,  lss: null,  unit: 'mg',  color: 'var(--amber)'  },
]

// Renvoie la couleur du badge et de la barre selon les seuils
function getStatus(val, ref, lss) {
  if (lss !== null && val >= lss) return 'excess'   // ≥ LSS : danger
  if (val >= ref)                  return 'ok'       // ≥ RNP : bon
  if (val >= ref * 0.5)            return 'mid'      // 50–99 % RNP : moyen
  return 'low'                                       // < 50 % RNP : insuffisant
}

const STATUS_COLOR = {
  excess: 'var(--coral)',
  ok:     '#1D9E75',
  mid:    'var(--amber)',
  low:    'var(--coral)',
}

const STATUS_LABEL = {
  excess: '⚠︎',
  ok:     null,
  mid:    null,
  low:    null,
}

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
            const hasData = val > 0

            // % par rapport à la RNP (peut dépasser 100)
            const pct = Math.round((val / v.ref) * 100)
            // largeur de la barre principale, plafonnée à la RNP (100 %)
            // sauf si pas de LSS : on laisse déborder jusqu'à 100 % visuellement
            const barPct = Math.min(100, pct)

            // Position du marqueur LSS sur la barre (en % de la largeur totale)
            // La barre représente 0→RNP sur 100% de sa largeur.
            // Le marqueur LSS se place à (LSS/RNP)*100%, plafonné à 100%.
            const lssMarkerPct = v.lss !== null
              ? Math.min(100, (v.lss / v.ref) * 100)
              : null

            const status = hasData ? getStatus(val, v.ref, v.lss) : 'low'
            const barColor = status === 'excess' ? 'var(--coral)' : v.color
            const badgeColor = STATUS_COLOR[status]

            // Tooltip : valeur brute + unité
            const tooltip = hasData
              ? `${val.toFixed(val < 1 ? 3 : 1)} ${v.unit} / RNP ${v.ref} ${v.unit}${v.lss ? ` / LSS ${v.lss} ${v.unit}` : ''}`
              : 'Données non disponibles'

            return (
              <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }} title={tooltip}>
                {/* Label */}
                <span style={{ fontSize: 12, color: 'var(--text)', width: 90, flexShrink: 0 }}>{v.label}</span>

                {/* Barre + marqueur LSS */}
                <div style={{ flex: 1, position: 'relative', height: 6 }}>
                  {/* Track */}
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    {/* Remplissage */}
                    <div style={{
                      width: hasData ? `${barPct}%` : '0%',
                      height: '100%',
                      background: barColor,
                      borderRadius: 3,
                      transition: 'width .4s',
                      opacity: hasData ? 1 : 0.3,
                    }} />
                  </div>

                  {/* Marqueur LSS — trait vertical semi-transparent */}
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

                {/* Badge % ou N/D */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: hasData ? badgeColor : 'var(--text-hint)',
                  width: 38,
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {hasData
                    ? `${STATUS_LABEL[status] ? STATUS_LABEL[status] + ' ' : ''}${pct}%`
                    : 'N/D'}
                </span>
              </div>
            )
          })}

          {/* Légende */}
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