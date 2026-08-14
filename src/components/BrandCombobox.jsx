import React, { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// ─────────────────────────────────────────────────────────────────────────────
// BrandCombobox — champ marque : sélectionne une marque existante dans la
// liste déroulante, ou tape un nom pour en créer une nouvelle à la volée.
// `options` est la liste des marques connues (fournie par le parent, qui gère
// le chargement/la création en base) ; ce composant reste purement contrôlé.
// ─────────────────────────────────────────────────────────────────────────────
export default function BrandCombobox({ value, onChange, options }) {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = normalize(value.trim())
    if (!q) return options
    return options.filter(o => normalize(o).includes(q))
  }, [options, value])

  const hasExactMatch = options.some(o => normalize(o) === normalize(value.trim()))
  const showCreate = value.trim() && !hasExactMatch

  const select = (name) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="Optionnel"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        style={{ paddingRight: 30 }}
      />
      <ChevronDown
        size={15}
        color="var(--text-hint)"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div className="card" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, padding: 4, maxHeight: 190, overflowY: 'auto' }}>
          {filtered.map(name => (
            <button
              key={name}
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(name)}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}
            >
              {name}
            </button>
          ))}
          {showCreate && (
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(value.trim())}
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}
            >
              + Créer "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
