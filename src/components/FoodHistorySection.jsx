import React from 'react'
import { History } from 'lucide-react'
import { useFoodHistory } from '../hooks/useFoodHistory'

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Rappel des anciennes quantités logguées pour CET aliment (voir
// useFoodHistory) — repère utile si un jour la balance n'est pas sous la
// main : on peut se recaler sur ce qui a été pesé les fois précédentes.
export default function FoodHistorySection({ food }) {
  const { history, loading } = useFoodHistory(food)

  if (loading || history.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <History size={13} color="var(--text-hint)" />
        <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
          Historique ({history.length} dernière{history.length > 1 ? 's' : ''} entrée{history.length > 1 ? 's' : ''})
        </div>
      </div>
      <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        {history.map((h, i) => (
          <div
            key={h.id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px',
              borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
              fontSize: 12.5,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{formatDate(h.date)}</span>
            <span style={{ fontWeight: 700 }}>{h.qty_g} g</span>
          </div>
        ))}
      </div>
    </div>
  )
}
