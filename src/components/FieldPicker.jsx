import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// FieldPicker — sélecteur de champ + sens de tri, réutilisé pour le critère
// principal et secondaire dans SortModal (recettes) et FoodSortModal (aliments).
// `fields` doit avoir la forme [{ key, label, ascLabel, descLabel }].
// ─────────────────────────────────────────────────────────────────────────────
export default function FieldPicker({ fields, selected, dir, onSelectField, onToggleDir, allowNone }) {
  const activeField = fields.find(f => f.key === selected)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: selected ? 10 : 0 }}>
        {allowNone && (
          <button
            onClick={() => onSelectField(null)}
            className="chip"
            style={selected === null ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
          >
            Aucun
          </button>
        )}
        {fields.map(f => (
          <button
            key={f.key}
            onClick={() => onSelectField(f.key)}
            className="chip"
            style={selected === f.key ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected && activeField && (
        <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
          {['asc', 'desc'].map(d => (
            <button
              key={d}
              onClick={() => { if (dir !== d) onToggleDir() }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
                background: dir === d ? 'var(--white)' : 'transparent',
                color: dir === d ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: dir === d ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {d === 'asc' ? activeField.ascLabel : activeField.descLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
