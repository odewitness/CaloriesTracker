import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// ShareJournalModal — confirme le partage d'une journée ou d'un seul repas
// sur le fil social, avec un message optionnel et le choix "macros
// uniquement" ou "détail des aliments".
// Props :
//   title       — ex: "Partager cette journée" / "Partager ce repas"
//   subtitle    — texte d'explication (nom du jour/repas)
//   onConfirm(message, includeDetail)
//   onClose
// ─────────────────────────────────────────────────────────────────────────────
export default function ShareJournalModal({ title, subtitle, onConfirm, onClose }) {
  useBackButton(onClose)
  const [message, setMessage] = useState('')
  const [includeDetail, setIncludeDetail] = useState(false)
  const [sending, setSending] = useState(false)

  const confirm = async () => {
    setSending(true)
    await onConfirm(message, includeDetail)
    setSending(false)
  }

  // Montée en portal sur document.body : appelée depuis DaySlot (TodayPage), qui
  // vit dans le slider de swipe en transform:translateX → un enfant
  // position:fixed s'y calerait (largeur ×3, décalé) au lieu du viewport, d'où la
  // feuille coupée sur les bords. Voir la règle « Notes utiles » de CLAUDE.md.
  return createPortal(
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{subtitle}</div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Ce que tes amies verront
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => setIncludeDetail(false)}
            className="chip"
            style={!includeDetail ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Macros uniquement
          </button>
          <button
            onClick={() => setIncludeDetail(true)}
            className="chip"
            style={includeDetail ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Détail des aliments
          </button>
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
    </div>,
    document.body
  )
}
