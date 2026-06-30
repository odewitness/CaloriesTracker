import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { VITAMIN_FIELDS, MINERAL_FIELDS } from '../lib/nutrients'
import NutrientBreakdownModal from './NutrientBreakdownModal'

// Pour les nutriments normaux (RNP = besoin minimum) : plus on s'approche de
// la ref, mieux c'est. Pour les nutriments "limite" (v.limite = true, ex. Sel,
// Sodium) c'est l'inverse : ref = objectif max à ne pas dépasser, donc rester
// en dessous = bien (vert), dépasser = pas bien (ambre/rouge).
function getStatus(val, ref, lss, limite) {
  if (limite) {
    if (lss !== null && val >= lss) return 'excess'
    if (val >= ref) return 'mid'
    return 'ok'
  }
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

function NutrientRow({ v, totals, hasEntries, onClick }) {
  const val = totals[v.key] ?? 0
  const hasData = hasEntries // N/D uniquement si aucune entrée loggée — 0 sur un aliment loggé est une vraie donnée

  const pct = Math.round((val / v.ref) * 100)
  const barPct = Math.min(100, pct)

  const lssMarkerPct = v.lss !== null
    ? Math.min(100, (v.lss / v.ref) * 100)
    : null

  const status = hasData ? getStatus(val, v.ref, v.lss, v.limite) : 'low'
  const badgeColor = STATUS_COLOR[status]

  const refLabel = v.limite ? 'Objectif max' : 'RNP'
  const lssLabel = v.limite ? 'Seuil' : 'LSS'
  const tooltip = hasData
    ? `${val.toFixed(val < 1 ? 3 : 1)} ${v.unit} / ${refLabel} ${v.ref} ${v.unit}${v.lss ? ` / ${lssLabel} ${v.lss} ${v.unit}` : ''}`
    : 'Données non disponibles'

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, width: '100%', textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}
      title={tooltip}
    >
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
    </Wrapper>
  )
}

export default function VitaminPanel({ totals, hasEntries, defaultOpen = false, entries }) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState('vitamines') // vitamines | mineraux
  const [selectedField, setSelectedField] = useState(null)

  // La liste détaillée par aliment n'a de sens que si on dispose des entrées
  // individuelles (ex: page d'accueil) — pas dans les contextes où VitaminPanel
  // affiche déjà un seul aliment (FoodDetailModal) ou un /100g de recette.
  const canBreakdown = entries && entries.length > 0

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
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setTab('vitamines')}
              className="chip"
              style={{ background: tab === 'vitamines' ? 'var(--green)' : 'var(--green-light)', color: tab === 'vitamines' ? 'white' : 'var(--green-dark)' }}
            >
              Vitamines
            </button>
            <button
              onClick={() => setTab('mineraux')}
              className="chip"
              style={{ background: tab === 'mineraux' ? 'var(--green)' : 'var(--green-light)', color: tab === 'mineraux' ? 'white' : 'var(--green-dark)' }}
            >
              Minéraux
            </button>
          </div>

          {(tab === 'vitamines' ? VITAMIN_FIELDS : MINERAL_FIELDS).map(v => (
            <NutrientRow
              key={v.key}
              v={v}
              totals={totals}
              hasEntries={hasEntries}
              onClick={canBreakdown ? () => setSelectedField(v) : undefined}
            />
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 2, height: 10, background: 'var(--coral)', borderRadius: 1, opacity: 0.55 }} />
              <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>LSS / Seuil</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>
              <span style={{ color: '#1D9E75', fontWeight: 600 }}>vert</span> = bien &nbsp;·&nbsp;
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>orange</span> = à surveiller &nbsp;·&nbsp;
              <span style={{ color: 'var(--coral)', fontWeight: 600 }}>rouge</span> = trop bas ou trop haut
            </span>
          </div>
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