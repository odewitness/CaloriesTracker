import React, { useState } from 'react'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// ShareRecipeModal — confirme le partage d'une recette sur le fil social, avec
// un message optionnel. Le snapshot est pris sur les données de base de la
// recette (ingredients/totaux passés tels quels par l'appelant), pas sur
// l'échelle d'affichage courante de RecipeDetailModal.
// ─────────────────────────────────────────────────────────────────────────────
export default function ShareRecipeModal({ recette, onConfirm, onClose }) {
  useBackButton(onClose)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const confirm = async () => {
    setSending(true)
    await onConfirm(message)
    setSending(false)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Partager avec tes amies</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          « {recette.nom} » sera visible dans le fil de tes amies. Si tu modifies la recette plus tard, le partage déjà publié ne changera pas.
        </div>

        <textarea
          className="input"
          placeholder="Un mot sur ce partage (optionnel)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          style={{ resize: 'none', marginBottom: 16 }}
        />

        <button className="btn-primary" onClick={confirm} disabled={sending} style={{ opacity: sending ? 0.7 : 1 }}>
          {sending ? 'Partage...' : 'Partager'}
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
