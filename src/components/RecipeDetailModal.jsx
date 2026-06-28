import React, { useMemo } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
import { useBackButton } from '../hooks/useBackButton'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'

// ─────────────────────────────────────────────────────────────────────────────
// MacroGrid — grille 5 colonnes kcal / P / G / L / F
// ─────────────────────────────────────────────────────────────────────────────
function MacroGrid({ totals }) {
  const items = [
    { label: 'kcal',   val: Math.round(totals.energie_kcal || 0), color: 'var(--text)'  },
    { label: 'Prot.',  val: `${(totals.proteines || 0).toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.',  val: `${(totals.glucides  || 0).toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',   val: `${(totals.lipides   || 0).toFixed(1)}g`, color: 'var(--coral)' },
    { label: 'Fibres', val: `${(totals.fibres    || 0).toFixed(1)}g`, color: 'var(--blue)'  },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 16 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetailModal
// Props :
//   recette      — objet recette (ligne Supabase)
//   ingredients  — tableau des ingrédients (lignes recette_ingredients)
//   onEdit()     — ouvre RecipeFormModal en mode édition
//   onDelete()   — supprime la recette
//   onClose()    — ferme la modal
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDetailModal({ recette, ingredients, onEdit, onDelete, onClose }) {
  useBackButton(onClose)

  // Totaux bruts (plat entier)
  const totaux = useMemo(() => sumIngredients(ingredients), [ingredients])

  // Référence de poids (cuit si renseigné, sinon cru)
  const poidsCruG  = ingredients.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0)
  const poidsCuitG = parseFloat(recette.poids_cuit_g) || 0
  const poidsRef   = poidsCuitG > 0 ? poidsCuitG : poidsCruG
  const estCuit    = poidsCuitG > 0

  // Valeurs /100g
  const per100 = useMemo(() => calcPer100g(totaux, poidsRef), [totaux, poidsRef])

  // Valeurs par portion
  const nbPortions       = parseInt(recette.portions, 10) || 1
  const grammesParPortion = poidsRef > 0 ? Math.round(poidsRef / nbPortions) : null
  const kcalParPortion   = per100 && grammesParPortion ? Math.round(per100.energie_kcal * grammesParPortion / 100) : null

  // Totaux /100g sous forme "totals" pour VitaminPanel et NutrientDetails
  const totals100 = per100 || {}

  return (
    <div className="page-modal">
      {/* Header */}
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.nom}</h2>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="btn-icon" onClick={onEdit}  style={{ color: 'var(--text-hint)' }}><Pencil  size={18} /></button>
          <button className="btn-icon" onClick={onDelete} style={{ color: 'var(--text-hint)' }}><Trash2  size={18} /></button>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
      </div>

      <div className="page-modal-body">
        {/* Meta recette */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
            {nbPortions} portion{nbPortions > 1 ? 's' : ''}
          </span>
          {grammesParPortion && (
            <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              ~{grammesParPortion} g / portion
            </span>
          )}
          {estCuit && (
            <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              ⚖️ pesé cuit
            </span>
          )}
        </div>

        {/* ── Valeurs /100g ── */}
        {per100 ? (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="section-title">Pour 100 g de plat {estCuit ? 'cuit' : 'cru'}</div>
            <MacroGrid totals={per100} />
            {kcalParPortion && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                → <strong style={{ color: 'var(--text)' }}>{kcalParPortion} kcal</strong> par portion ({grammesParPortion} g)
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
          </div>
        )}

        {/* ── Valeurs plat entier ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div className="section-title">Plat entier ({Math.round(poidsRef)} g)</div>
          <MacroGrid totals={totaux} />
        </div>

        {/* ── Liste ingrédients ── */}
        <div className="section-title" style={{ marginTop: 4 }}>Ingrédients ({ingredients.length})</div>
        {ingredients.map((ing, idx) => (
          <div key={ing.id || idx} className="card" style={{ marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {ing.qty_g}g&nbsp;·&nbsp;
                <span className="c-prot">P {(ing.proteines || 0).toFixed(1)}g</span>&nbsp;
                <span className="c-gluc">G {(ing.glucides  || 0).toFixed(1)}g</span>&nbsp;
                <span className="c-lip">L {(ing.lipides   || 0).toFixed(1)}g</span>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(ing.energie_kcal || 0)} kcal</span>
          </div>
        ))}

        {/* ── Vitamines / minéraux / sucres / gras (basés sur /100g) ── */}
        {per100 && (
          <>
            <div style={{ marginTop: 12 }}>
              <VitaminPanel totals={totals100} hasEntries={true} />
            </div>
            <NutrientDetails totals={totals100} hasEntries={true} />
          </>
        )}
      </div>
    </div>
  )
}