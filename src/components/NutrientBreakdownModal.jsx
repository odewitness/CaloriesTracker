import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import FoodDetailModal from './FoodDetailModal'

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
//   onUpdate(id, patch) — optionnel, transmis depuis TodayPage. Permet
//             d'éditer le grammage depuis la fiche aliment ouverte en
//             drill-down ; si absent, la fiche s'ouvre en lecture seule.
// ─────────────────────────────────────────────────────────────────────────────
export default function NutrientBreakdownModal({ field, entries, onClose, onUpdate }) {
  useBackButton(onClose)
  const [selectedEntry, setSelectedEntry] = useState(null)

const rows = useMemo(() => {
  const keys = field.sumKeys || [field.key]
  return (entries || [])
    .map(e => ({ entry: e, val: keys.reduce((s, k) => s + (e[k] ?? 0), 0) }))
    .filter(r => r.val > 0)
    .sort((a, b) => b.val - a.val)
}, [entries, field])

  const maxVal = rows.length > 0 ? rows[0].val : 0

  return createPortal(
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body">
        {rows.length === 0 ? (
          <div className="empty">
            Aucun aliment renseigné aujourd'hui ne contient de {field.label.toLowerCase()}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map((r, i) => (
              <button
                key={i}
                className="card"
                onClick={() => setSelectedEntry(r.entry)}
                style={{ padding: '12px 14px', width: '100%', textAlign: 'left', display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.entry.food_name}{r.entry.qty_g ? <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>{` · ${r.entry.qty_g}g`}</span> : null}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmtVal(r.val, field.unit)}</span>
                    <ChevronRight size={15} color="var(--text-hint)" />
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${maxVal > 0 ? (r.val / maxVal) * 100 : 0}%`,
                    height: '100%',
                    background: field.color || 'var(--green)',
                    borderRadius: 3,
                  }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedEntry && (
        <FoodDetailModal
          key={selectedEntry.id}
          entry={selectedEntry}
          onUpdate={onUpdate}
          onBack={() => setSelectedEntry(null)}
          onClose={() => { setSelectedEntry(null); onClose() }}
        />
      )}
    </div>,
    document.body
  )
}