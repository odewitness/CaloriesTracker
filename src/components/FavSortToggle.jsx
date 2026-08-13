import React from 'react'

const FAV_SORTS = [
  { id: 'recent', label: 'Récents' },
  { id: 'alpha',  label: 'A→Z' },
  { id: 'most',   label: 'Top' },
]

// value/dir décrivent le tri actif ; cliquer sur le mode déjà actif doit
// l'inverser plutôt que ne rien faire — c'est onChange (dans FoodPicker)
// qui décide, ce composant se contente de notifier l'id cliqué.
export default function FavSortToggle({ value, dir, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {FAV_SORTS.map(s => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
              padding: '3px 9px', borderRadius: 20, border: 'none',
              background: active ? 'var(--green)' : 'var(--gray-bg)',
              color: active ? 'white' : 'var(--text-muted)',
              transition: 'all .15s',
            }}
          >
            {s.label}
            {active && <span style={{ fontSize: 9 }}>{dir === 'asc' ? '▲' : '▼'}</span>}
          </button>
        )
      })}
    </div>
  )
}
