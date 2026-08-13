import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import FoodDetailModal from './FoodDetailModal'
import EmptyState from './EmptyState'

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

// Regroupe les entrées par nom d'aliment et somme leur contribution — un
// aliment loggé plusieurs fois (même jour ou jours différents sur une période
// Semaine/Mois/Année) apparaît en une seule ligne avec le total, plutôt qu'en
// autant de lignes que d'occurrences.
// Le clic → édition individuelle (FoodDetailModal) ne reste possible que si
// le groupe ne contient qu'UNE occurrence : au-delà, il n'y a plus une entrée
// précise à éditer, donc la ligne devient non cliquable (affichage seul).
const rows = useMemo(() => {
  const keys = field.sumKeys || [field.key]
  const byFood = new Map()
  for (const e of (entries || [])) {
    const val = keys.reduce((s, k) => s + (e[k] ?? 0), 0)
    if (val <= 0) continue
    const group = byFood.get(e.food_name)
    if (group) {
      group.val += val
      group.count += 1
      group.entries.push(e)
    } else {
      byFood.set(e.food_name, { food_name: e.food_name, val, count: 1, entries: [e] })
    }
  }
  return Array.from(byFood.values()).sort((a, b) => b.val - a.val)
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
          <EmptyState>
            Aucun aliment renseigné ne contient de {field.label.toLowerCase()} sur cette période.
          </EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map((r, i) => {
              const single = r.count === 1
              const Wrapper = single ? 'button' : 'div'
              return (
                <Wrapper
                  key={i}
                  className="card"
                  onClick={single ? () => setSelectedEntry(r.entries[0]) : undefined}
                  style={{ padding: '12px 14px', width: '100%', textAlign: 'left', display: 'block', cursor: single ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.food_name}
                        {single && r.entries[0].qty_g
                          ? <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>{` · ${r.entries[0].qty_g}g`}</span>
                          : !single
                            ? <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>{` · ×${r.count}`}</span>
                            : null}
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmtVal(r.val, field.unit)}</span>
                      {single && <ChevronRight size={15} color="var(--text-hint)" />}
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
                </Wrapper>
              )
            })}
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