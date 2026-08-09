import React, { useState, useMemo } from 'react'
import { X, Search, Check, ArrowLeft } from 'lucide-react'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// AddFromRecipeModal
// Étape 1 : choisir une recette (recherche par nom)
// Étape 2 : cocher/décocher ses ingrédients (tous cochés par défaut), valider
//
// Props :
//   onAdd(recette, ingredientsSelectionnes) — appelé à la validation
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function AddFromRecipeModal({ onAdd, onClose }) {
  useBackButton(onClose)
  const { recettes, loading } = useRecipes()
  const [query, setQuery] = useState('')
  const [selectedRecette, setSelectedRecette] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recettes
    return recettes.filter(r => (r.nom || '').toLowerCase().includes(q))
  }, [recettes, query])

  if (selectedRecette) {
    return (
      <IngredientPicker
        recette={selectedRecette}
        onBack={() => setSelectedRecette(null)}
        onAdd={onAdd}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ajouter depuis une recette</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            placeholder="Rechercher une recette..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

        {!loading && filtered.length === 0 && (
          <div className="empty">
            <div style={{ marginTop: 8, fontWeight: 600 }}>Aucune recette</div>
            {recettes.length === 0 && (
              <div style={{ marginTop: 4 }}>Crée d'abord une recette dans "Mes aliments"</div>
            )}
          </div>
        )}

        {filtered.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedRecette(r)}
            className="card"
            style={{ width: '100%', marginBottom: 8, padding: '12px 14px', textAlign: 'left' }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nom}</div>
            {r.energie_kcal != null && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {Math.round(r.energie_kcal)} kcal/100g
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IngredientPicker — étape 2
// ─────────────────────────────────────────────────────────────────────────────
function IngredientPicker({ recette, onBack, onAdd, onClose }) {
  const { ingredients, loading } = useRecetteDetail(recette.id)
  // null = "tous sélectionnés" (état par défaut avant toute interaction)
  const [selectedIds, setSelectedIds] = useState(null)
  const [adding, setAdding] = useState(false)

  const isSelected = (id) => selectedIds === null || selectedIds.includes(id)

  const toggle = (id) => {
    setSelectedIds(prev => {
      const base = prev === null ? ingredients.map(i => i.id) : prev
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id]
    })
  }

  const selectedCount = selectedIds === null ? ingredients.length : selectedIds.length

  const confirm = async () => {
    if (selectedCount === 0) return
    setAdding(true)
    const toAdd = selectedIds === null ? ingredients : ingredients.filter(i => selectedIds.includes(i.id))
    await onAdd(recette, toAdd)
    setAdding(false)
    onClose()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onBack} style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></button>
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.nom}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

        {!loading && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Décoche les ingrédients que tu as déjà, ou que tu ne veux pas acheter.
            </div>

            {ingredients.map(ing => {
              const sel = isSelected(ing.id)
              return (
                <button
                  key={ing.id}
                  onClick={() => toggle(ing.id)}
                  className="card"
                  style={{ width: '100%', marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${sel ? 'var(--green)' : 'var(--border-md)'}`,
                    background: sel ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {sel && <Check size={13} color="white" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, opacity: sel ? 1 : 0.5 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{ing.food_name}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, opacity: sel ? 1 : 0.5 }}>{ing.qty_g} g</span>
                </button>
              )
            })}

            <button
              className="btn-primary"
              onClick={confirm}
              disabled={adding || selectedCount === 0}
              style={{ opacity: adding || selectedCount === 0 ? 0.5 : 1, marginTop: 8 }}
            >
              {adding ? 'Ajout...' : `Ajouter ${selectedCount} ingrédient${selectedCount > 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
