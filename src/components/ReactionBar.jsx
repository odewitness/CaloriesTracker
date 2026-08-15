import React from 'react'
import { REACTION_EMOJIS } from '../lib/reactions'

// ─────────────────────────────────────────────────────────────────────────────
// ReactionBar — palette fixe de réactions emoji sur un partage. Toggle on/off
// par emoji, un compteur s'affiche dès qu'au moins une personne a réagi.
// ─────────────────────────────────────────────────────────────────────────────
export default function ReactionBar({ reactions, userId, onToggle }) {
  const counts = {}
  const mine = new Set()
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1
    if (r.user_id === userId) mine.add(r.emoji)
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {REACTION_EMOJIS.map(emoji => {
        const count = counts[emoji] || 0
        const active = mine.has(emoji)
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 11px', borderRadius: 20, fontSize: 15,
              background: active ? 'var(--green-light)' : 'var(--gray-bg)',
              border: active ? '1px solid var(--green)' : '1px solid transparent',
            }}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: active ? 'var(--green-dark)' : 'var(--text-muted)' }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
