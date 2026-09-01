import React, { useState } from 'react'
import { MoreVertical, Trash2, MessageCircle } from 'lucide-react'
import MacroPillsRow from './MacroPillsRow'
import ReactionBar from './ReactionBar'
import Avatar from './Avatar'
import RecipePhoto from './RecipePhoto'

function formatDate(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─────────────────────────────────────────────────────────────────────────────
// PartageCard — carte d'un partage de recette dans le fil. Les réactions sont
// disponibles directement sur la carte (comme un fil social classique), sans
// avoir à ouvrir le détail.
// ─────────────────────────────────────────────────────────────────────────────
export default function PartageCard({ partage, isOwn, commentCount, reactions, userId, onToggleReaction, onOpen, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const poidsRef = partage.poids_cuit_g || partage.poids_cru_g || null
  const poidsParPortion = poidsRef ? poidsRef / (partage.portions || 1) : null
  const factor = poidsParPortion ? poidsParPortion / 100 : null

  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16, cursor: 'pointer' }} onClick={() => onOpen(partage)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
          <Avatar userId={partage.auteur_id} name={auteurLabel} size={30} style={{ marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', fontWeight: 600 }}>
              {auteurLabel} · {formatDate(partage.created_at)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{partage.nom}</div>
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

      <RecipePhoto recetteId={partage.recette_id} version={partage.photo_updated_at} style={{ marginBottom: 8 }} />

      {partage.energie_kcal != null && (
        <>
          <MacroPillsRow
            label="100 g" labelColor="var(--text-hint)" bg="var(--gray-bg)"
            kcal={partage.energie_kcal} kcalColor="var(--text)"
            proteines={partage.proteines || 0} glucides={partage.glucides || 0} lipides={partage.lipides || 0}
            marginBottom={factor != null ? 6 : 8}
          />
          {factor != null && (
            <MacroPillsRow
              label="Portion" labelColor="var(--green-dark)" bg="var(--green-light)"
              kcal={partage.energie_kcal * factor} kcalColor="var(--green-dark)"
              proteines={(partage.proteines || 0) * factor} glucides={(partage.glucides || 0) * factor} lipides={(partage.lipides || 0) * factor}
              marginBottom={8}
            />
          )}
        </>
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
