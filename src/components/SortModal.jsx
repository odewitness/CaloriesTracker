import React, { useState, useEffect } from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_FIELDS, SORT_BASES } from '../lib/recipeSort'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'

// ─── Sélecteur de champ + sens, réutilisé pour le critère principal et secondaire ───
function FieldPicker({ fields, selected, dir, onSelectField, onToggleDir, allowNone }) {
  const activeField = SORT_FIELDS.find(f => f.key === selected)

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

// ─────────────────────────────────────────────────────────────────────────────
// SortModal — critère principal + critère secondaire optionnel
// (ex: "moins caloriques, puis plus de protéines")
// ─────────────────────────────────────────────────────────────────────────────
export default function SortModal({ value, onChange, onClose }) {
  useBackButton(onClose)
  const [primaryField, setPrimaryField]     = useState(value.primary.field)
  const [primaryDir, setPrimaryDir]         = useState(value.primary.dir)
  const [secondaryField, setSecondaryField] = useState(value.secondary?.field || null)
  const [secondaryDir, setSecondaryDir]     = useState(value.secondary?.dir || 'desc')
  const [basis, setBasis]                   = useState(value.basis || 'per100g')
  const [categories, setCategories]         = useState(value.categories || [])

  // Si le critère secondaire devient identique au principal, on l'efface
  useEffect(() => { if (secondaryField === primaryField) setSecondaryField(null) }, [primaryField]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const apply = () => {
    onChange({
      primary: { field: primaryField, dir: primaryDir },
      secondary: secondaryField ? { field: secondaryField, dir: secondaryDir } : null,
      basis,
      categories,
    })
    onClose()
  }

  const reset = () => {
    setPrimaryField('nom'); setPrimaryDir('asc')
    setSecondaryField(null); setSecondaryDir('desc')
    setBasis('per100g')
    setCategories([])
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Trier / filtrer les recettes</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Choisis un critère principal, et éventuellement un second pour départager les égalités.
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Filtrer par catégorie <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-hint)' }}>(optionnel)</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {RECIPE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className="chip"
              style={categories.includes(cat) ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Trier par
        </div>
        <FieldPicker
          fields={SORT_FIELDS}
          selected={primaryField}
          dir={primaryDir}
          onSelectField={setPrimaryField}
          onToggleDir={() => setPrimaryDir(d => d === 'asc' ? 'desc' : 'asc')}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '18px 0 8px' }}>
          Puis par <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-hint)' }}>(optionnel)</span>
        </div>
        <FieldPicker
          fields={SORT_FIELDS.filter(f => f.key !== primaryField)}
          selected={secondaryField}
          dir={secondaryDir}
          onSelectField={setSecondaryField}
          onToggleDir={() => setSecondaryDir(d => d === 'asc' ? 'desc' : 'asc')}
          allowNone
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '18px 0 8px' }}>
          Base de calcul
        </div>
        <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
          {SORT_BASES.map(b => (
            <button
              key={b.key}
              onClick={() => setBasis(b.key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
                background: basis === b.key ? 'var(--white)' : 'transparent',
                color: basis === b.key ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: basis === b.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        <button className="btn-primary" onClick={apply} style={{ marginTop: 20 }}>Appliquer</button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={reset}>Réinitialiser</button>
      </div>
    </div>
  )
}
