import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_FIELDS, SORT_BASES, describeSortField } from '../lib/mealTemplateSort'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'
import { getRecipeCategoryIcon } from '../lib/categoryIcons'
import FieldPicker from './FieldPicker'

// ─────────────────────────────────────────────────────────────────────────────
// MealTemplateSortModal — même principe que SortModal (recettes), sans
// l'onglet durée (pas de temps de prépa/cuisson pour un repas type).
// ─────────────────────────────────────────────────────────────────────────────
export default function MealTemplateSortModal({ value, onChange, onClose }) {
  useBackButton(onClose)
  const [activeTab, setActiveTab] = useState('filtrer') // 'filtrer' | 'trier'

  const [primaryField, setPrimaryField]     = useState(value.primary.field)
  const [primaryDir, setPrimaryDir]         = useState(value.primary.dir)
  const [secondaryField, setSecondaryField] = useState(value.secondary?.field || null)
  const [secondaryDir, setSecondaryDir]     = useState(value.secondary?.dir || 'desc')
  const [basis, setBasis]                   = useState(value.basis || 'total')
  const [categories, setCategories]         = useState(value.categories || [])

  // Si le critère secondaire devient identique au principal, on l'efface
  useEffect(() => { if (secondaryField === primaryField) setSecondaryField(null) }, [primaryField]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const filterCount = categories.length
  const sortIsCustom = primaryField !== 'nom' || primaryDir !== 'asc' || !!secondaryField || basis === 'portion'

  const activeChips = [
    ...categories.map(cat => ({
      id: `cat:${cat}`, label: `${getRecipeCategoryIcon(cat)} ${cat}`, onRemove: () => toggleCategory(cat),
    })),
    ...(primaryField !== 'nom' || primaryDir !== 'asc' ? [{
      id: 'sort-primary',
      label: `Trier : ${describeSortField({ field: primaryField, dir: primaryDir }, basis)}`,
      onRemove: () => { setPrimaryField('nom'); setPrimaryDir('asc') },
    }] : []),
    ...(secondaryField ? [{
      id: 'sort-secondary',
      label: `Puis : ${describeSortField({ field: secondaryField, dir: secondaryDir }, basis)}`,
      onRemove: () => setSecondaryField(null),
    }] : []),
    ...(basis === 'portion' ? [{
      id: 'sort-basis',
      label: 'Par portion',
      onRemove: () => setBasis('total'),
    }] : []),
  ]

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
    setBasis('total')
    setCategories([])
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ display: 'flex', flexDirection: 'column', padding: 0, maxHeight: '86dvh' }}>

        {/* En-tête fixe : poignée, titre + fermer, résumé des filtres/tri actifs, onglets */}
        <div style={{ flexShrink: 0, padding: '14px 20px 0' }}>
          <div className="modal-handle" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Trier &amp; filtrer</span>
            <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fermer">
              <X size={19} />
            </button>
          </div>

          {activeChips.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {activeChips.map(chip => (
                <button
                  key={chip.id}
                  onClick={chip.onRemove}
                  className="chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, paddingRight: 8 }}
                >
                  {chip.label}
                  <X size={12} />
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, background: 'var(--gray-bg)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
            <button
              onClick={() => setActiveTab('filtrer')}
              style={{
                flex: 1, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: activeTab === 'filtrer' ? 700 : 600, fontFamily: 'var(--font)',
                background: activeTab === 'filtrer' ? 'var(--white)' : 'transparent',
                color: activeTab === 'filtrer' ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: activeTab === 'filtrer' ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                transition: 'all .15s',
              }}
            >
              Filtrer
              {filterCount > 0 && (
                <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 9, minWidth: 18, height: 18, padding: '0 5px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {filterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('trier')}
              style={{
                flex: 1, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: activeTab === 'trier' ? 700 : 600, fontFamily: 'var(--font)',
                background: activeTab === 'trier' ? 'var(--white)' : 'transparent',
                color: activeTab === 'trier' ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: activeTab === 'trier' ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                transition: 'all .15s',
              }}
            >
              Trier
              {sortIsCustom && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
              )}
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 14px' }}>
          {activeTab === 'filtrer' ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 9 }}>
                Catégories
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RECIPE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="chip"
                    style={categories.includes(cat) ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                  >
                    {getRecipeCategoryIcon(cat)} {cat}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Pied fixe */}
        <div style={{ flexShrink: 0, padding: '12px 20px calc(18px + env(safe-area-inset-bottom))', borderTop: '.5px solid var(--border)' }}>
          <button className="btn-primary" onClick={apply}>Appliquer</button>
          <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 8 }} onClick={reset}>Réinitialiser</button>
        </div>
      </div>
    </div>
  )
}
