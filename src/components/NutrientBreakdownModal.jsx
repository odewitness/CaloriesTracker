import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'

function fmtVal(val, unit) {
  if (val == null) return '—'
  return `${val < 1 && val > 0 ? val.toFixed(2) : Math.round(val * 10) / 10} ${unit}`
}

// ─────────────────────────────────────────────────────────────────────────────
// NutrientBreakdownModal
// Affiche, pour un nutriment donné (vitamine/minéral/sucre/acide gras), la
// liste des aliments du jour qui en contiennent, triés du plus au moins riche.
// Props :
//   field   — { key, label, unit, color? } le nutriment cliqué
//   entries — tableau d'aliments du jour (journal), valeurs déjà au prorata
//             du grammage consommé (pas du /100g)
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function NutrientBreakdownModal({ field, entries, onClose }) {
  useBackButton(onClose)

  const rows = useMemo(() => {
    return (entries || [])
      .map(e => ({ name: e.food_name, qty: e.qty_g, val: e[field.key] }))
      .filter(r => r.val != null && r.val > 0)
      .sort((a, b) => b.val - a.val)
  }, [entries, field])

  const maxVal = rows.length > 0 ? rows[0].val : 0

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{field.label}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>

        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-hint)', padding: '24px 0', textAlign: 'center' }}>
            Aucun aliment renseigné aujourd'hui ne contient de {field.label.toLowerCase()}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {r.name}{r.qty ? <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>{` · ${r.qty}g`}</span> : null}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{fmtVal(r.val, field.unit)}</span>
                </div>
                <div style={{ height: 5, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${maxVal > 0 ? (r.val / maxVal) * 100 : 0}%`,
                    height: '100%',
                    background: field.color || 'var(--green)',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
