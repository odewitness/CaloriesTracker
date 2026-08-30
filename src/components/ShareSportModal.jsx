import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// ShareSportModal — confirme le partage d'une séance ou d'un résumé de semaine
// sur le fil, avec un message optionnel. Monté via portal (comme les feuilles
// de TodayPage).
// Props :
//   title      — ex. « Partager cette séance » / « Partager ma semaine »
//   subtitle   — récap de ce qui sera partagé
//   onConfirm(message)
//   onClose
// ─────────────────────────────────────────────────────────────────────────────
export default function ShareSportModal({ title, subtitle, onConfirm, onClose }) {
  useBackButton(onClose)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const confirm = async () => {
    setSending(true)
    await onConfirm(message)
    setSending(false)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{subtitle}</div>

        <textarea
          className="input"
          placeholder="Un mot sur ce partage (optionnel)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          style={{ resize: 'none', marginBottom: 16 }}
        />

        <button className="btn-primary" onClick={confirm} disabled={sending} style={{ opacity: sending ? 0.7 : 1 }}>
          {sending ? 'Partage…' : 'Partager avec mes amies'}
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>,
    document.body,
  )
}
