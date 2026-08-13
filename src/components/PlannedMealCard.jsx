import React, { useState } from 'react'
import { Check, Trash2, ChevronRight, CalendarX } from 'lucide-react'
import { fmt } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// PlannedMealCard — carte compacte pour un repas planifié (repas_planifies).
// Props :
//   repas         — ligne repas_planifies { nom, meal, items, mange, source_type, source_id, recurrence_group_id, ... }
//   onMarkEaten() — async, copie les items dans le journal
//   onDelete()    — async, supprime cette occurrence du repas planifié
//   onDeleteSeries(recurrenceGroupId) — optionnel ; si fourni ET que repas
//                          fait partie d'une série récurrente, affiche un
//                          second bouton "supprimer toute la série"
//   onOpenSource(repas) — optionnel ; si fourni, le nom du repas devient
//                          cliquable et ouvre sa "page dédiée" (recette /
//                          repas type / aliment)
// ─────────────────────────────────────────────────────────────────────────────
export default function PlannedMealCard({ repas, onMarkEaten, onDelete, onDeleteSeries, onOpenSource }) {
  const [busy, setBusy] = useState(false)
  const items = repas.items || []
  const totalKcal = items.reduce((s, i) => s + (i.energie_kcal || 0), 0)
  const clickable = !!onOpenSource
  const missed = !repas.mange && repas.date < fmt(new Date())
  const isSeries = !!repas.recurrence_group_id

  const handleMarkEaten = async () => {
    setBusy(true)
    await onMarkEaten(repas)
    setBusy(false)
  }

  const handleDeleteSeries = async () => {
    if (!window.confirm('Supprimer toute la série récurrente ?')) return
    setBusy(true)
    await onDeleteSeries(repas.recurrence_group_id)
    setBusy(false)
  }

  return (
    <div className="card" style={{
      marginBottom: 8, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
      opacity: repas.mange ? 0.6 : 1,
    }}>
      <div
        onClick={clickable ? () => onOpenSource(repas) : undefined}
        style={{ flex: 1, minWidth: 0, cursor: clickable ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: missed ? 'var(--coral)' : 'var(--purple)',
            background: missed ? 'var(--coral-light)' : 'var(--purple-light)', borderRadius: 6, padding: '1px 6px',
          }}>
            {repas.meal}
          </span>
          {repas.mange && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)' }}>✓ Mangé</span>
          )}
          {missed && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)' }}>Manqué</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {repas.nom}
          </span>
          {clickable && <ChevronRight size={14} color="var(--text-hint)" style={{ flexShrink: 0 }} />}
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
      {isSeries && onDeleteSeries && (
        <button
          onClick={handleDeleteSeries}
          disabled={busy}
          className="btn-icon"
          style={{ color: 'var(--text-hint)', flexShrink: 0 }}
          aria-label="Supprimer toute la série"
          title="Supprimer toute la série récurrente"
        >
          <CalendarX size={16} />
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