import React, { useState, useEffect, useMemo } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useBackButton } from '../hooks/useBackButton'
import { scaleFood } from '../lib/nutrients'
import { getComplementNutrients } from '../lib/complementNutrients'
import ComplementNutrientPills from './ComplementNutrientPills'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// EditSupplementModal — modification d'un complément déjà ajouté au journal (ou
// encore programmé), avec la même UI "dose" que l'écran d'ajout (FoodPicker en
// mode complément) : chips de portions courantes, stepper de nombre de doses,
// aperçu %AJR vitamines/minéraux — plutôt que l'écran générique en grammes/
// macros de FoodDetailModal, qui n'a pas de sens pour un complément.
// Props :
//   entry      — { id, food_name, food_ref_id, qty_g, meal } issu du journal
//                 ou d'un repas_planifie (items[0])
//   onUpdate(id, patch) — si fourni, affiche le bouton de sauvegarde ; sinon
//                          l'écran reste consultable mais en lecture seule
//   onClose(), onBack()
// ─────────────────────────────────────────────────────────────────────────────
export default function EditSupplementModal({ entry, onUpdate, onClose, onBack }) {
  useBackButton(onBack || onClose)
  const { user } = useAuth()
  const [food, setFood] = useState(null) // ligne aliments_custom fraîche (portions + valeurs /100g)
  const [loading, setLoading] = useState(true)
  const [doseCountText, setDoseCountText] = useState('1')
  const [saving, setSaving] = useState(false)
  const canEdit = typeof onUpdate === 'function'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase.from('aliments_custom').select('*').eq('id', entry.food_ref_id).eq('user_id', user.id).single()
      .then(({ data }) => {
        if (cancelled) return
        setFood(data)
        const doseUnit = data?.portions?.[0]?.g || 1
        setDoseCountText(String(Math.round((entry.qty_g / doseUnit) * 100) / 100))
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.food_ref_id, user])

  const doseUnitG = food?.portions?.[0]?.g || 1
  const qty = (parseFloat(doseCountText) || 0) * doseUnitG
  const dirty = Math.abs(qty - entry.qty_g) > 1e-9

  const setDoseCount = (text) => setDoseCountText(text)

  const nutrients = useMemo(() => food ? getComplementNutrients(food, qty / 100) : [], [food, qty])

  const save = async () => {
    if (!food || qty <= 0) return
    setSaving(true)
    const { error } = await onUpdate(entry.id, scaleFood(food, qty))
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
          {loading ? <Loader /> : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{entry.meal}</div>

              {food?.portions?.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>Portions courantes</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {food.portions.map((p, i) => (
                      <button key={i} className="chip" onClick={() => setDoseCount(String(p.g / doseUnitG))}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>
                  Nombre de doses ({food?.portions?.[0]?.label || '1 dose'})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn-icon"
                    style={{ background: 'var(--gray-bg)' }}
                    onClick={() => setDoseCount(String(Math.max(0, (parseFloat(doseCountText) || 0) - 1)))}
                  >−</button>
                  <input
                    className="input-sm"
                    type="text"
                    inputMode="decimal"
                    value={doseCountText}
                    onChange={e => setDoseCount(e.target.value)}
                    style={{ width: 60, textAlign: 'center' }}
                  />
                  <button
                    className="btn-icon"
                    style={{ background: 'var(--gray-bg)' }}
                    onClick={() => setDoseCount(String((parseFloat(doseCountText) || 0) + 1))}
                  >+</button>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                {nutrients.length > 0 ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ComplementNutrientPills nutrients={nutrients} />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune vitamine ou minéral renseigné</div>
                )}
              </div>

              {dirty && canEdit && (
                <button className="btn-primary" onClick={save} disabled={saving || qty <= 0} style={{ marginBottom: 16, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Sauvegarde...' : '💾 Enregistrer'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
