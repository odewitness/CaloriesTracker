import React, { useState } from 'react'
import { Check, Trash2, Clock } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// PlannedMealCard — carte compacte pour un repas planifié (repas_planifies).
// Props :
//   repas         — ligne repas_planifies { nom, meal, items, mange, ... }
//   onMarkEaten() — async, copie les items dans le journal
//   onDelete()    — async, supprime le repas planifié
// ─────────────────────────────────────────────────────────────────────────────
export default function PlannedMealCard({ repas, onMarkEaten, onDelete }) {
  const [busy, setBusy] = useState(false)
  const items = repas.items || []
  const totalKcal = items.reduce((s, i) => s + (i.energie_kcal || 0), 0)

  const handleMarkEaten = async () => {
    setBusy(true)
    await onMarkEaten(repas)
    setBusy(false)
  }

  return (
    <div className="card" style={{
      marginBottom: 8, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
      opacity: repas.mange ? 0.6 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--purple)',
            background: 'var(--purple-light)', borderRadius: 6, padding: '1px 6px',
          }}>
            {repas.meal}
          </span>
          {repas.mange && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>✓ Mangé</span>
          )}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {repas.nom}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
          {items.length} aliment{items.length > 1 ? 's' : ''} · {Math.round(totalKcal)} kcal
        </div>
      </div>

      {!repas.mange && (
        <button
          onClick={handleMarkEaten}
          disabled={busy}
          className="btn-icon"
          style={{ background: 'var(--green-light)', color: 'var(--green-dark)', flexShrink: 0 }}
          aria-label="Marquer mangé"
          title="Marquer mangé"
        >
          <Check size={16} />
        </button>
      )}
      <button
        onClick={() => onDelete(repas.id)}
        disabled={busy}
        className="btn-icon"
        style={{ color: 'var(--text-hint)', flexShrink: 0 }}
        aria-label="Supprimer"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}
