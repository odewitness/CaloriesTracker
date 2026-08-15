import React, { useState } from 'react'
import { Send, Trash2, CornerDownRight } from 'lucide-react'

function formatDate(iso) {
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function CommentRow({ comment, userId, onDelete, isReply, onReplyClick }) {
  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 6, marginLeft: isReply ? 22 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{comment.auteur_pseudo || comment.auteur_prenom || 'Une amie'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>{formatDate(comment.created_at)}</span>
          {comment.auteur_id === userId && (
            <button onClick={() => onDelete(comment.id)} style={{ color: 'var(--text-hint)' }} aria-label="Supprimer">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word', marginBottom: !isReply ? 4 : 0 }}>{comment.contenu}</div>
      {!isReply && (
        <button
          onClick={onReplyClick}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--text-hint)' }}
        >
          <CornerDownRight size={12} /> Répondre
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CommentsList — commentaires d'un partage (avec réponses, un seul niveau de
// profondeur) + formulaire d'ajout.
// ─────────────────────────────────────────────────────────────────────────────
export default function CommentsList({ comments, userId, onAdd, onDelete }) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null) // id du commentaire auquel on répond, ou null
  const [replyValue, setReplyValue] = useState('')
  const [replySending, setReplySending] = useState(false)

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_id) (acc[c.parent_id] ||= []).push(c)
    return acc
  }, {})

  const submit = async (e) => {
    e.preventDefault()
    if (!value.trim() || sending) return
    setSending(true)
    await onAdd(value)
    setValue('')
    setSending(false)
  }

  const submitReply = async (e, parentId) => {
    e.preventDefault()
    if (!replyValue.trim() || replySending) return
    setReplySending(true)
    await onAdd(replyValue, parentId)
    setReplyValue('')
    setReplySending(false)
    setReplyingTo(null)
  }

  return (
    <div>
      <div className="section-title">Commentaires{comments.length > 0 ? ` (${comments.length})` : ''}</div>

      {topLevel.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 12 }}>Aucun commentaire pour l'instant.</div>
      ) : (
        topLevel.map(c => (
          <div key={c.id}>
            <CommentRow
              comment={c}
              userId={userId}
              onDelete={onDelete}
              onReplyClick={() => { setReplyingTo(r => r === c.id ? null : c.id); setReplyValue('') }}
            />
            {(repliesByParent[c.id] || []).map(reply => (
              <CommentRow key={reply.id} comment={reply} userId={userId} onDelete={onDelete} isReply />
            ))}
            {replyingTo === c.id && (
              <form onSubmit={e => submitReply(e, c.id)} style={{ display: 'flex', gap: 8, marginLeft: 22, marginBottom: 10 }}>
                <input
                  className="input-sm"
                  placeholder="Répondre..."
                  value={replyValue}
                  onChange={e => setReplyValue(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={replySending || !replyValue.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'var(--green)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (replySending || !replyValue.trim()) ? 0.6 : 1,
                  }}
                  aria-label="Envoyer la réponse"
                >
                  <Send size={14} />
                </button>
              </form>
            )}
          </div>
        ))
      )}

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          className="input"
          placeholder="Ajouter un commentaire..."
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={sending || !value.trim()}
          style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'var(--green)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: (sending || !value.trim()) ? 0.6 : 1,
          }}
          aria-label="Envoyer"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
