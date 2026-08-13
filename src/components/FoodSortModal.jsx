import React, { useState, useEffect } from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_FIELDS } from '../lib/foodSort'
import { FOOD_CATEGORIES } from '../lib/foodCategories'
import FieldPicker from './FieldPicker'

// ─────────────────────────────────────────────────────────────────────────────
// FoodSortModal — critère principal + critère secondaire optionnel, et filtre
// par catégorie. Même principe que SortModal (recettes), sans le sélecteur de
// base de calcul (un aliment personnalisé n'a que sa valeur pour 100g / dose).
// ─────────────────────────────────────────────────────────────────────────────
export default function FoodSortModal({ value, onChange, onClose }) {
  useBackButton(onClose)
  const [primaryField, setPrimaryField]     = useState(value.primary.field)
  const [primaryDir, setPrimaryDir]         = useState(value.primary.dir)
  const [secondaryField, setSecondaryField] = useState(value.secondary?.field || null)
  const [secondaryDir, setSecondaryDir]     = useState(value.secondary?.dir || 'desc')
  const [categories, setCategories]         = useState(value.categories || [])

  // Si le critère secondaire devient identique au principal, on l'efface
  useEffect(() => { if (secondaryField === primaryField) setSecondaryField(null) }, [primaryField]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const apply = () => {
    onChange({
      primary: { field: primaryField, dir: primaryDir },
      secondary: secondaryField ? { field: secondaryField, dir: secondaryDir } : null,
      categories,
    })
    onClose()
  }

  const reset = () => {
    setPrimaryField('nom'); setPrimaryDir('asc')
    setSecondaryField(null); setSecondaryDir('desc')
    setCategories([])
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Trier / filtrer les aliments</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Choisis un critère principal, et éventuellement un second pour départager les égalités.
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Filtrer par catégorie <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-hint)' }}>(optionnel)</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {FOOD_CATEGORIES.map(cat => (
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

        <button className="btn-primary" onClick={apply} style={{ marginTop: 20 }}>Appliquer</button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={reset}>Réinitialiser</button>
      </div>
    </div>
  )
}
