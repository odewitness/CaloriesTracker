import React, { useState } from 'react'
import { MoreVertical, Trash2, MessageCircle, Dumbbell, CalendarDays } from 'lucide-react'
import ReactionBar from './ReactionBar'
import Avatar from './Avatar'
import {
  sportTypeEmoji, sportTypeLabel, sportIntensiteLabel, formatDuree,
} from '../lib/sport'

function formatWhen(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function sportSummaryLine(p) {
  if (p.kind === 'semaine') {
    return `${Math.round(p.total_min || 0)} min · ${p.nb_seances || 0} séance${(p.nb_seances || 0) > 1 ? 's' : ''}`
  }
  return [
    formatDuree(p.duree_min),
    p.distance_km ? `${p.distance_km} km` : null,
    sportIntensiteLabel(p.intensite) ? sportIntensiteLabel(p.intensite).toLowerCase() : null,
  ].filter(Boolean).join(' · ')
}

// ─────────────────────────────────────────────────────────────────────────────
// SportPartageCard — carte d'un partage de sport (séance ou résumé de semaine)
// dans le fil. Miroir de JournalPartageCard.
// ─────────────────────────────────────────────────────────────────────────────
export default function SportPartageCard({ partage, isOwn, commentCount, reactions, userId, onToggleReaction, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'
  const isWeek = partage.kind === 'semaine'
  const title = isWeek
    ? `Semaine du ${new Date((partage.semaine_debut || partage.created_at) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : sportTypeLabel(partage.type)
  const kcal = isWeek ? partage.total_kcal : partage.energie_kcal

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16, cursor: 'pointer' }} onClick={() => onOpen(partage)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
          <Avatar userId={partage.auteur_id} name={auteurLabel} size={30} style={{ marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', fontWeight: 600 }}>
              {auteurLabel} · {formatWhen(partage.created_at)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{isWeek ? '📅' : sportTypeEmoji(partage.type)}</span> {title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              {isWeek ? <CalendarDays size={12} /> : <Dumbbell size={12} />} {sportSummaryLine(partage)}
            </div>
          </div>
        </div>
        {isOwn && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
              className="btn-icon"
              style={{ color: 'var(--text-hint)' }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
                <div className="card" style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, padding: 4, minWidth: 150 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(partage) }}
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

      {partage.message && (
        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.4 }}>{partage.message}</div>
      )}

      {kcal != null && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 9, padding: '4px 10px', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
          ≈ {Math.round(kcal)} kcal{isWeek ? ' cette semaine' : ''}
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <ReactionBar reactions={reactions} userId={userId} onToggle={emoji => onToggleReaction(partage, emoji)} />
      </div>

      {commentCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-hint)' }}>
          <MessageCircle size={13} /> {commentCount} commentaire{commentCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
