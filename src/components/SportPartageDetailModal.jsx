import React, { useState } from 'react'
import { ArrowLeft, X, MoreVertical, Trash2 } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import Loader from './Loader'
import {
  sportTypeEmoji, sportTypeLabel, sportIntensiteLabel, formatDuree,
} from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportPartageDetailModal — vue en lecture seule d'un partage de sport (séance
// ou résumé de semaine). Miroir de JournalPartageDetailModal (sans liste de
// détail : le partage se suffit à lui-même).
// ─────────────────────────────────────────────────────────────────────────────
export default function SportPartageDetailModal({ partage, loading, isOwn, onDelete, onClose, reactionsSlot, commentsSlot }) {
  useBackButton(onClose)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!partage) {
    return (
      <div className="page-modal">
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Partage</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        {loading ? <Loader /> : <div style={{ padding: 20, fontSize: 13, color: 'var(--text-hint)' }}>Introuvable.</div>}
      </div>
    )
  }

  const isWeek = partage.kind === 'semaine'
  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'
  const title = isWeek
    ? `Semaine du ${new Date((partage.semaine_debut || partage.created_at) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : sportTypeLabel(partage.type)
  const emoji = isWeek ? '📅' : sportTypeEmoji(partage.type)
  const kcal = isWeek ? partage.total_kcal : partage.energie_kcal
  const dateLabel = !isWeek && partage.date
    ? new Date(partage.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  const stats = isWeek
    ? [
        { label: 'Temps', value: formatDuree(partage.total_min) },
        { label: 'Séances', value: `${partage.nb_seances || 0}` },
        kcal != null ? { label: 'Calories', value: `≈ ${Math.round(kcal)}` } : null,
      ].filter(Boolean)
    : [
        { label: 'Durée', value: formatDuree(partage.duree_min) },
        partage.distance_km ? { label: 'Distance', value: `${partage.distance_km} km` } : null,
        sportIntensiteLabel(partage.intensite) ? { label: 'Intensité', value: sportIntensiteLabel(partage.intensite) } : null,
        kcal != null ? { label: 'Calories', value: `≈ ${Math.round(kcal)}` } : null,
      ].filter(Boolean)

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emoji} {title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            Partagé par {auteurLabel}{dateLabel ? ` · ${dateLabel}` : ''}
          </div>
        </div>
        {isOwn && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button className="btn-icon" onClick={() => setMenuOpen(o => !o)} style={{ color: 'var(--text-hint)' }}><MoreVertical size={18} /></button>
            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(false)} />
                <div className="card" style={{ position: 'absolute', top: 38, right: 0, zIndex: 10, padding: 4, minWidth: 180 }}>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete() }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Trash2 size={14} /> Retirer mon partage
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="page-modal-body">
        {partage.message && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12, fontSize: 13.5, lineHeight: 1.4 }}>
            {partage.message}
          </div>
        )}

        <div className="card" style={{ padding: '14px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8 }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {reactionsSlot}
        {commentsSlot}
      </div>
    </div>
  )
}
