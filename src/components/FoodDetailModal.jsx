import React, { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'

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

export default function FoodDetailModal({ entry, onUpdate, onClose }) {
  useBackButton(onClose)
  const [qty, setQty] = useState(String(entry.qty_g))
  const [saving, setSaving] = useState(false)

  const f = useMemo(() => {
    const newQty = parseFloat(qty)
    if (!newQty || newQty <= 0 || !entry.qty_g) return 0
    return newQty / entry.qty_g
  }, [qty, entry])

  // "live" = toutes les valeurs nutritionnelles de l'aliment recalculées au
  // prorata du grammage en cours d'édition — sert à la fois à l'aperçu macro
  // et, en l'état exact d'un objet "totals", à VitaminPanel/NutrientDetails
  // (ces deux composants sont déjà génériques sur un totals + hasEntries).
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
    const { error } = await onUpdate(entry.id, patch)
    setSaving(false)
    if (!error) onClose()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
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

          {dirty && (
            <button className="btn-primary" onClick={save} disabled={saving} style={{ marginBottom: 16, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Sauvegarde...' : '💾 Enregistrer le grammage'}
            </button>
          )}

          <VitaminPanel totals={live} hasEntries={true} />
          <NutrientDetails totals={live} hasEntries={true} />
        </div>
      </div>
    </div>
  )
}