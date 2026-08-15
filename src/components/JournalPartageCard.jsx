import React, { useState } from 'react'
import { MoreVertical, Trash2, MessageCircle, UtensilsCrossed } from 'lucide-react'
import MacroPillsRow from './MacroPillsRow'
import ReactionBar from './ReactionBar'

function formatDate(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatJournalDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─────────────────────────────────────────────────────────────────────────────
// JournalPartageCard — carte d'un partage de journée/repas dans le fil.
// ─────────────────────────────────────────────────────────────────────────────
export default function JournalPartageCard({ partage, isOwn, commentCount, reactions, userId, onToggleReaction, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'
  const label = partage.meal ? partage.meal : 'Journée complète'

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16, cursor: 'pointer' }} onClick={() => onOpen(partage)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', fontWeight: 600 }}>
            {auteurLabel} · {formatDate(partage.created_at)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, textTransform: 'capitalize' }}>{formatJournalDate(partage.date)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <UtensilsCrossed size={12} /> {label}
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

      <MacroPillsRow
        label="Total" labelColor="var(--green-dark)" bg="var(--green-light)"
        kcal={partage.energie_kcal || 0} kcalColor="var(--green-dark)"
        proteines={partage.proteines || 0} glucides={partage.glucides || 0} lipides={partage.lipides || 0}
        marginBottom={8}
      />

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
