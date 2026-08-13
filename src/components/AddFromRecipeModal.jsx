import React, { useState, useMemo } from 'react'
import { X, Search, Check, ArrowLeft, Minus, Plus } from 'lucide-react'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import { useBackButton } from '../hooks/useBackButton'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// AddFromRecipeModal
// Étape 1 : choisir une recette (recherche par nom)
// Étape 2 : choisir le nombre de portions souhaité (met à l'échelle les
//           grammages), puis cocher/décocher les ingrédients à ajouter
//
// Props :
//   onAdd(recette, ingredientsSelectionnesEtMisÀLÉchelle) — appelé à la validation
//   onClose()
//   defaultPortions — optionnel, portions initiales du stepper. Par défaut
//                      (non fourni) : nb de portions de la recette de base,
//                      comme avant. PlanMealModal passe 1 pour que planifier
//                      une recette parte toujours d'1 portion.
// ─────────────────────────────────────────────────────────────────────────────
export default function AddFromRecipeModal({ onAdd, onClose, defaultPortions }) {
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
        defaultPortions={defaultPortions}
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

        {loading && <Loader />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            title="Aucune recette"
            description={recettes.length === 0 ? 'Crée d\'abord une recette dans "Mes aliments"' : null}
          />
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
// PortionsStepper
// ─────────────────────────────────────────────────────────────────────────────
function PortionsStepper({ value, onChange, min = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', borderRadius: 20, padding: 3 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: value <= min ? 'var(--text-hint)' : 'var(--text)',
          border: 'none', opacity: value <= min ? 0.5 : 1,
        }}
      >
        <Minus size={13} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: 'var(--text)', border: 'none',
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IngredientPicker — étape 2
// ─────────────────────────────────────────────────────────────────────────────
function IngredientPicker({ recette, onBack, onAdd, onClose, defaultPortions }) {
  const { ingredients, loading } = useRecetteDetail(recette.id)
  const nbPortionsBase = parseInt(recette.portions, 10) || 1
  const [portionsSouhaitees, setPortionsSouhaitees] = useState(defaultPortions ?? nbPortionsBase)
  // null = "tous sélectionnés" (état par défaut avant toute interaction)
  const [selectedIds, setSelectedIds] = useState(null)
  const [adding, setAdding] = useState(false)

  const factor = nbPortionsBase > 0 ? portionsSouhaitees / nbPortionsBase : 1
  const scaled = factor !== 1

  // Ingrédients avec TOUTES leurs valeurs (grammage ET nutriments) mises à
  // l'échelle du nb de portions souhaité — c'est ce tableau qui sert à la
  // fois à l'affichage et à l'ajout/planification. Avant, seul qty_g était
  // recalculé : sélectionner 1 portion sur 4 affichait le bon grammage mais
  // gardait les kcal/macros du plat entier.
  const scaledIngredients = useMemo(
    () => ingredients.map(i => {
      const scaled = {
        ...i,
        qty_g:        i.qty_g        != null ? Math.round(i.qty_g * factor * 10) / 10 : i.qty_g,
        energie_kcal: i.energie_kcal != null ? parseFloat((i.energie_kcal * factor).toFixed(1)) : i.energie_kcal,
        proteines:    i.proteines    != null ? parseFloat((i.proteines    * factor).toFixed(2)) : i.proteines,
        glucides:     i.glucides     != null ? parseFloat((i.glucides     * factor).toFixed(2)) : i.glucides,
        lipides:      i.lipides      != null ? parseFloat((i.lipides      * factor).toFixed(2)) : i.lipides,
        fibres:       i.fibres       != null ? parseFloat((i.fibres       * factor).toFixed(2)) : i.fibres,
      }
      for (const key of ALL_NUTRIENT_KEYS) {
        scaled[key] = i[key] != null ? parseFloat((i[key] * factor).toFixed(4)) : i[key]
      }
      return scaled
    }),
    [ingredients, factor]
  )

  const isSelected = (id) => selectedIds === null || selectedIds.includes(id)

  const toggle = (id) => {
    setSelectedIds(prev => {
      const base = prev === null ? ingredients.map(i => i.id) : prev
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id]
    })
  }

  const selectedCount = selectedIds === null ? scaledIngredients.length : selectedIds.length

  const confirm = async () => {
    if (selectedCount === 0) return
    setAdding(true)
    const toAdd = selectedIds === null ? scaledIngredients : scaledIngredients.filter(i => selectedIds.includes(i.id))
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
        {loading && <Loader />}

        {!loading && (
          <>
            {/* Sélecteur de portions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Portions :</span>
              <PortionsStepper value={portionsSouhaitees} onChange={setPortionsSouhaitees} />
            </div>
            {scaled && (
              <div style={{ fontSize: 12, color: 'var(--green-dark)', marginBottom: 10 }}>
                × {factor.toFixed(2).replace(/\.?0+$/, '')} — recette de base pour {nbPortionsBase} portion{nbPortionsBase > 1 ? 's' : ''}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, marginTop: scaled ? 0 : 6 }}>
              Décoche les ingrédients que tu as déjà, ou que tu ne veux pas acheter.
            </div>

            {scaledIngredients.map(ing => {
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