import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SUGAR_FIELDS, FAT_FIELDS, SUCRES_ANSES_REF, KCAL_PER_G_LIPIDES, LIPIDES_AE_TARGET, AGS_AE_MAX } from '../lib/nutrients'
import NutrientBreakdownModal from './NutrientBreakdownModal'

function fmtVal(val, unit) {
  if (val == null) return '—'
  return `${val < 1 && val > 0 ? val.toFixed(2) : Math.round(val * 10) / 10} ${unit}`
}

function NutrientList({ fields, totals, hasEntries, entries, onSelectField }) {
  const canBreakdown = entries && entries.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {fields.map(f => {
        const val = hasEntries ? (totals[f.key] ?? 0) : null
        const Wrapper = canBreakdown ? 'button' : 'div'
        return (
          <Wrapper
            key={f.key}
            onClick={canBreakdown ? () => onSelectField(f) : undefined}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, width: '100%', textAlign: 'left', cursor: canBreakdown ? 'pointer' : 'default' }}
          >
            <span style={{ color: 'var(--text)' }}>{f.label}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{hasEntries ? fmtVal(val, f.unit) : 'N/D'}</span>
          </Wrapper>
        )
      })}
    </div>
  )
}

// Exported: reused as-is by HistoryPage.jsx so the period dashboard shows the
// exact same Anses gauge as TodayPage, just fed with period-averaged totals
// instead of today's totals.
export function SucresAnsesGauge({ totals, hasEntries }) {
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

function GaugeBar({ barPct, color, bandMarkers }) {
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      {bandMarkers && bandMarkers.map((pct, i) => (
        <div key={i} style={{
          position: 'absolute', top: -1, bottom: -1, left: `${pct}%`, width: 2,
          background: 'var(--text-muted)', opacity: 0.5, transform: 'translateX(-50%)',
        }} />
      ))}
    </div>
  )
}

// Lipides totaux : l'Anses recommande une zone cible de 35-40% de l'apport
// énergétique (AE) du jour, pas un simple plafond — en dessous = sous-couverture
// des besoins, au-dessus = excès. On affiche donc une bande cible plutôt qu'un seuil.
export function LipidesTotauxGauge({ totals, hasEntries }) {
  const hasKcal = hasEntries && totals.kcal > 0
  const aePct = hasKcal ? (totals.lip * KCAL_PER_G_LIPIDES / totals.kcal) * 100 : 0
  const { min, max } = LIPIDES_AE_TARGET
  const SCALE = 50 // échelle visuelle du graphique (0-50% AE)
  const barPct = hasKcal ? Math.min(100, (aePct / SCALE) * 100) : 0
  const bandMarkers = [(min / SCALE) * 100, (max / SCALE) * 100]

  const inRange = aePct >= min && aePct <= max
  const color = !hasKcal ? 'var(--text-hint)' : inRange ? '#1D9E75' : aePct > max ? 'var(--coral)' : 'var(--amber)'
  const note = !hasKcal ? '' : inRange ? '' : aePct > max ? ' (au-dessus de la cible)' : ' (en dessous de la cible)'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Lipides totaux</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {hasKcal ? `${aePct.toFixed(1)}% AE${note}` : 'N/D'}
        </span>
      </div>
      <GaugeBar barPct={barPct} color={color} bandMarkers={bandMarkers} />
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Cible Anses : {min}-{max}% de l'apport énergétique du jour
      </div>
    </div>
  )
}

// AG saturés totaux : seuil maximal (≤12% AE), pas une zone cible.
export function AGSGauge({ totals, hasEntries }) {
  const hasKcal = hasEntries && totals.kcal > 0
  const ags = totals.acides_gras_satures ?? 0
  const aePct = hasKcal ? (ags * KCAL_PER_G_LIPIDES / totals.kcal) * 100 : 0
  const SCALE = AGS_AE_MAX * 1.5
  const barPct = hasKcal ? Math.min(100, (aePct / SCALE) * 100) : 0
  const excess = hasKcal && aePct >= AGS_AE_MAX
  const color = !hasKcal ? 'var(--text-hint)' : excess ? 'var(--coral)' : aePct >= AGS_AE_MAX * 0.8 ? 'var(--amber)' : '#1D9E75'

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--gray-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>AG saturés totaux</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {hasKcal ? `${excess ? '⚠︎ ' : ''}${aePct.toFixed(1)}% AE` : 'N/D'}
        </span>
      </div>
      <GaugeBar barPct={barPct} color={color} bandMarkers={[(AGS_AE_MAX / SCALE) * 100]} />
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Max recommandé Anses : {AGS_AE_MAX}% de l'apport énergétique du jour
      </div>
    </div>
  )
}

export default function NutrientDetails({ totals, hasEntries, defaultOpen = false, entries }) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState('sucres') // sucres | gras
  const [selectedField, setSelectedField] = useState(null)

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
                <NutrientList fields={SUGAR_FIELDS} totals={totals} hasEntries={hasEntries} entries={entries} onSelectField={setSelectedField} />
              </>
            )
            : (
              <>
                <LipidesTotauxGauge totals={totals} hasEntries={hasEntries} />
                <AGSGauge totals={totals} hasEntries={hasEntries} />
                <NutrientList fields={FAT_FIELDS} totals={totals} hasEntries={hasEntries} entries={entries} onSelectField={setSelectedField} />
              </>
            )}

        </div>
      )}

      {selectedField && (
        <NutrientBreakdownModal
          field={selectedField}
          entries={entries}
          onClose={() => setSelectedField(null)}
        />
      )}
    </div>
  )
}