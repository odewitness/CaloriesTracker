import React, { useState, useMemo } from 'react'
import { X, ChevronLeft, BookOpen } from 'lucide-react'
import NutrientPanel from './NutrientPanel'
import FodmapPanel from './FodmapPanel'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { entryToFood } from '../lib/journalEntry'
import { useBackButton } from '../hooks/useBackButton'

// Re-scale une liste d'ingrédients (voir journal.ingredients_detail) au
// grammage total en cours d'édition, en conservant l'ancien grammage barré
// (`qty_g_avant`) au prorata si présent.
function rescaleIngredients(list, factor) {
  return (list || []).map(i => ({
    food_name: i.food_name,
    qty_g: Math.round(i.qty_g * factor * 10) / 10,
    ...(i.qty_g_avant != null ? { qty_g_avant: Math.round(i.qty_g_avant * factor * 10) / 10 } : {}),
  }))
}

function MacroGrid({ live }) {
  const items = [
    { label: 'kcal',  val: Math.round(live.kcal), color: 'var(--text)' },
    { label: 'Prot.', val: `${live.prot.toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.', val: `${live.gluc.toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',  val: `${live.lip.toFixed(1)}g`,  color: 'var(--coral)' },
    { label: 'Fibres',val: `${live.fib.toFixed(1)}g`,  color: 'var(--blue)' },
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

export default function FoodDetailModal({ entry, onUpdate, onClose, onBack, onOpenRecipe }) {
  // Si on vient d'un drill-down (ex: liste des aliments riches en tel nutriment),
  // le bouton matériel "retour" doit remonter d'un niveau (onBack) plutôt que
  // fermer toute la pile de modaux (onClose).
  useBackButton(onBack || onClose)
  const [qty, setQty] = useState(String(entry.qty_g))
  const [saving, setSaving] = useState(false)
  const canEdit = typeof onUpdate === 'function'

  const f = useMemo(() => {
    const newQty = parseFloat(qty)
    if (!newQty || newQty <= 0 || !entry.qty_g) return 0
    return newQty / entry.qty_g
  }, [qty, entry])

  // "live" = toutes les valeurs nutritionnelles de l'aliment recalculées au
  // prorata du grammage en cours d'édition — sert à la fois à l'aperçu macro
  // et, en l'état exact d'un objet "totals", à NutrientPanel (déjà générique
  // sur un totals + hasEntries).
  const live = useMemo(() => {
    const t = {
      kcal: (entry.energie_kcal || 0) * f,
      prot: (entry.proteines || 0) * f,
      gluc: (entry.glucides || 0) * f,
      lip:  (entry.lipides || 0) * f,
      fib:  (entry.fibres || 0) * f,
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = entry[key]
      t[key] = raw != null ? raw * f : null
    }
    return t
  }, [entry, f])

  // Aliment ajouté depuis une recette via la recherche (FoodPicker) : seul
  // chemin d'ajout où le journal garde un lien vers la recette (food_ref_id)
  // — voir CLAUDE.md / RecipeQuantityAdjustModal. Le bouton "Voir la fiche"
  // s'appuie uniquement sur ce lien (disponible même sur les entrées
  // anciennes) ; la liste d'ingrédients, elle, n'existe que si l'entrée porte
  // un `ingredients_detail` (ajoutée après l'introduction de cette fonctionnalité).
  const isRecipeEntry = entry.food_source === 'recette' && !!entry.food_ref_id
  const liveIngredients = useMemo(() => (
    entry.ingredients_detail?.length ? rescaleIngredients(entry.ingredients_detail, f) : null
  ), [entry, f])

  // Aliment /100 g reconstruit depuis l'entrée, pour le bloc FODMAP (qui relit
  // lui-même la ligne Ciqual à jour quand l'entrée vient de Ciqual).
  const fodmapFood = useMemo(() => entryToFood(entry), [entry])

  const dirty = parseFloat(qty) !== entry.qty_g

  const save = async () => {
    const newQty = parseFloat(qty)
    if (!newQty || newQty <= 0) return
    setSaving(true)
    const patch = {
      qty_g: newQty,
      energie_kcal: parseFloat(live.kcal.toFixed(1)),
      proteines: parseFloat(live.prot.toFixed(2)),
      glucides: parseFloat(live.gluc.toFixed(2)),
      lipides: parseFloat(live.lip.toFixed(2)),
      fibres: parseFloat(live.fib.toFixed(2)),
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = live[key]
      patch[key] = raw != null ? parseFloat(raw.toFixed(4)) : null
    }
    if (entry.ingredients_detail?.length) {
      patch.ingredients_detail = rescaleIngredients(entry.ingredients_detail, f)
    }
    const { error } = await onUpdate(entry.id, patch)
    setSaving(false)
    if (!error) (onBack || onClose)()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        {onBack ? (
          <button className="btn-icon" onClick={onBack} aria-label="Retour">
            <ChevronLeft size={20} color="var(--text-muted)" />
          </button>
        ) : (
          <div style={{ width: 32, flexShrink: 0 }} />
        )}
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.food_name}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{entry.meal}</div>

          {/* Grammage modifiable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <input
              className="input-sm"
              type="text"
              inputMode="decimal"
              value={qty}
              onChange={e => setQty(e.target.value)}
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
          </div>

          <MacroGrid live={live} />

          {dirty && canEdit && (
            <button className="btn-primary" onClick={save} disabled={saving} style={{ marginBottom: 16, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Sauvegarde...' : '💾 Enregistrer le grammage'}
            </button>
          )}

          <NutrientPanel totals={live} hasEntries={true} defaultOpen={true} />

          <FodmapPanel food={fodmapFood} qty={qty} />

          {isRecipeEntry && (
            <div style={{ marginTop: 16 }}>
              {liveIngredients && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Ingrédients</div>
                  {liveIngredients.map((ing, idx) => {
                    const changed = ing.qty_g_avant != null && Math.round(ing.qty_g_avant) !== Math.round(ing.qty_g)
                    return (
                      <div
                        key={idx}
                        className="card"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', marginBottom: 6 }}
                      >
                        <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                          {ing.food_name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                          {changed && (
                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontWeight: 400, marginRight: 6 }}>
                              {Math.round(ing.qty_g_avant)} g
                            </span>
                          )}
                          {Math.round(ing.qty_g)} g
                        </span>
                      </div>
                    )
                  })}
                </>
              )}

              {typeof onOpenRecipe === 'function' && (
                <button
                  onClick={() => onOpenRecipe(entry.food_ref_id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    width: '100%', padding: '9px 12px', marginTop: liveIngredients ? 4 : 0,
                    background: 'var(--gray-bg)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600,
                    fontFamily: 'var(--font)',
                  }}
                >
                  <BookOpen size={14} /> Voir la fiche
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}