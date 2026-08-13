import React from 'react'

const FAV_SORTS = [
  { id: 'recent', label: 'Récents' },
  { id: 'alpha',  label: 'A→Z' },
  { id: 'most',   label: 'Top' },
]

export default function FavSortToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {FAV_SORTS.map(s => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
              padding: '3px 9px', borderRadius: 20, border: 'none',
              background: active ? 'var(--green)' : 'var(--gray-bg)',
              color: active ? 'white' : 'var(--text-muted)',
              transition: 'all .15s',
            }}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
