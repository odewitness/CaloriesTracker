import React, { useState } from 'react'
import { X, Trash2, CalendarX, CalendarClock, Pill, UtensilsCrossed } from 'lucide-react'
import { usePlannedSeries, deletePlannedMeal, deletePlannedMealSeries } from '../hooks/usePlannedMeals'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { useBackButton } from '../hooks/useBackButton'
import { SUPPLEMENT_MEAL } from './SupplementSection'
import Loader from './Loader'
import EmptyState from './EmptyState'

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─────────────────────────────────────────────────────────────────────────────
// PlannedSeriesModal — "Mes programmations" : une ligne par programmation
// (série récurrente regroupée, ou occurrence isolée), toutes les
// programmations à venir non mangées, repas et compléments confondus.
// Permet de supprimer une série entière en un clic (au lieu de le faire
// jour par jour depuis le récap du jour) — typiquement pour corriger une
// programmation récurrente mal réglée avant de la refaire correctement.
// ─────────────────────────────────────────────────────────────────────────────
export default function PlannedSeriesModal({ onClose, onChange }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const toast = useToast()
  const { series, loading, refetch } = usePlannedSeries()
  const [busyKey, setBusyKey] = useState(null)

  const handleDelete = async (item) => {
    const confirmMsg = item.recurrenceGroupId
      ? `Supprimer toute la série "${item.nom}" (${item.count} occurrences) ?`
      : `Supprimer "${item.nom}" ?`
    if (!window.confirm(confirmMsg)) return
    setBusyKey(item.key)
    const { error } = item.recurrenceGroupId
      ? await deletePlannedMealSeries(item.recurrenceGroupId, user.id)
      : await deletePlannedMeal(item.id, user.id)
    setBusyKey(null)
    if (!error) { toast('Supprimé'); refetch(); onChange?.() }
    else toast('Erreur')
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Mes programmations</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {loading && <Loader />}
        {!loading && series.length === 0 && (
          <EmptyState
            icon={<CalendarClock size={40} />}
            title="Aucune programmation"
            description="Les repas et compléments planifiés à l'avance apparaîtront ici"
          />
        )}
        {series.map(item => {
          const isSupplement = item.meal === SUPPLEMENT_MEAL
          const Icon = isSupplement ? Pill : UtensilsCrossed
          const range = item.count > 1
            ? `${formatDateShort(item.firstDate)} → ${formatDateShort(item.lastDate)} · ${item.count}×`
            : formatDateShort(item.firstDate)
          return (
            <div
              key={item.key}
              className="card"
              style={{ marginBottom: 8, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: isSupplement ? 'var(--purple-light, #ede9fe)' : 'var(--green-light)',
                color: isSupplement ? 'var(--purple, #8b5cf6)' : 'var(--green-dark)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: isSupplement ? 'var(--purple, #8b5cf6)' : 'var(--green-dark)',
                  background: isSupplement ? 'var(--purple-light, #ede9fe)' : 'var(--green-light)',
                  borderRadius: 6, padding: '1px 6px',
                }}>
                  {item.meal}
                </span>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.nom}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  {range}
                </div>
              </div>
              <button
                onClick={() => handleDelete(item)}
                disabled={busyKey === item.key}
                className="btn-icon"
                style={{ color: 'var(--text-hint)', flexShrink: 0 }}
                aria-label={item.recurrenceGroupId ? 'Supprimer toute la série' : 'Supprimer'}
                title={item.recurrenceGroupId ? 'Supprimer toute la série' : 'Supprimer'}
              >
                {item.recurrenceGroupId ? <CalendarX size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
