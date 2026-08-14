import React, { useState, useEffect, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useBackButton } from '../hooks/useBackButton'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// RecipeQuantityAdjustModal — depuis FoodPicker, quand une recette est
// choisie comme aliment à journaliser d'un coup (poids total) : permet de
// corriger le grammage de certains ingrédients pour CETTE fournée (ex. 150g
// de riz au lieu des 200g prévus), sans toucher à la recette enregistrée.
// À la validation, recalcule le grammage total et le profil /100g qui
// remplacent ceux utilisés par FoodPicker pour journaliser l'entrée.
//
// Props :
//   recetteId, recetteNom
//   currentQtyG — grammage actuellement affiché dans FoodPicker, sert de
//                 point de départ pour mettre les ingrédients à l'échelle
//   onApply(newQtyG, newPer100)
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeQuantityAdjustModal({ recetteId, recetteNom, currentQtyG, onApply, onClose }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const [ingredients, setIngredients] = useState(null) // null = chargement
  const [poidsRef, setPoidsRef] = useState(0)
  const [overrides, setOverrides] = useState({})
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('recette_ingredients')
        .select('*')
        .eq('recette_id', recetteId)
        .eq('user_id', user.id)
      if (cancelled) return
      const list = data || []
      setIngredients(list)
      setPoidsRef(list.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0))
    })()
    return () => { cancelled = true }
  }, [recetteId, user.id])

  const baseFactor = (ingredients && poidsRef > 0) ? (currentQtyG / poidsRef) : 1

  const scaledIngredients = useMemo(() => {
    if (!ingredients) return []
    return ingredients.map(i => {
      const baseQty = (i.qty_g || 0) * baseFactor
      const override = overrides[i.id]
      const adjustFactor = (override != null && baseQty) ? override / baseQty : 1
      const totalFactor = baseFactor * adjustFactor
      const s = {
        id:           i.id,
        food_name:    i.food_name,
        qty_g:        baseQty * adjustFactor,
        energie_kcal: (i.energie_kcal || 0) * totalFactor,
        proteines:    (i.proteines    || 0) * totalFactor,
        glucides:     (i.glucides     || 0) * totalFactor,
        lipides:      (i.lipides      || 0) * totalFactor,
        fibres:       (i.fibres       || 0) * totalFactor,
        sel:                 (i.sel                 || 0) * totalFactor,
        sucres:              (i.sucres              || 0) * totalFactor,
        acides_gras_satures: (i.acides_gras_satures || 0) * totalFactor,
      }
      for (const key of ALL_NUTRIENT_KEYS) {
        s[key] = i[key] != null ? i[key] * totalFactor : null
      }
      return s
    })
  }, [ingredients, baseFactor, overrides])

  const commitOverride = (id, rawValue) => {
    setEditingId(null)
    const val = parseFloat(String(rawValue).replace(',', '.'))
    if (!isFinite(val) || val <= 0) return
    setOverrides(prev => ({ ...prev, [id]: val }))
  }

  const totalQtyG = scaledIngredients.reduce((s, i) => s + (i.qty_g || 0), 0)
  const totalKcal = scaledIngredients.reduce((s, i) => s + (i.energie_kcal || 0), 0)

  const confirm = () => {
    if (!ingredients || totalQtyG <= 0) return
    const totaux = sumIngredients(scaledIngredients)
    const per100 = calcPer100g(totaux, totalQtyG)
    onApply(Math.round(totalQtyG * 10) / 10, per100)
    onClose()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recetteNom}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {ingredients === null ? (
          <Loader />
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Appuie sur un grammage pour le corriger. Ça n'ajuste que cette entrée, la recette elle-même ne change pas.
            </div>

            {scaledIngredients.map(ing => {
              const isEditing = editingId === ing.id
              return (
                <div
                  key={ing.id}
                  className="card"
                  style={{ width: '100%', marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ing.food_name}
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      autoFocus
                      defaultValue={Math.round(ing.qty_g)}
                      onFocus={e => e.target.select()}
                      onBlur={e => commitOverride(ing.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.target.blur()
                        if (e.key === 'Escape') { e.target.value = Math.round(ing.qty_g); e.target.blur() }
                      }}
                      style={{ width: 56, fontSize: 13, textAlign: 'right', border: '1px solid var(--border-md)', borderRadius: 6, padding: '3px 6px', flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditingId(ing.id)}
                      style={{
                        fontSize: 13, fontWeight: 600, flexShrink: 0, cursor: 'pointer',
                        textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2,
                      }}
                    >
                      {Math.round(ing.qty_g)} g
                    </span>
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 3px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(totalQtyG)} g · {Math.round(totalKcal)} kcal</span>
            </div>

            <button
              className="btn-primary"
              onClick={confirm}
              disabled={totalQtyG <= 0}
              style={{ opacity: totalQtyG <= 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Check size={16} /> Valider ces quantités
            </button>
          </>
        )}
      </div>
    </div>
  )
}
