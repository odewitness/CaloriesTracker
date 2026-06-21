import React, { useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'

function EditRow({ entry, onSave, onCancel }) {
  useBackButton(onCancel)
  const [qty, setQty] = useState(String(entry.qty_g))
  const [kcal, setKcal] = useState(entry.energie_kcal)
  const [prot, setProt] = useState(entry.proteines)
  const [gluc, setGluc] = useState(entry.glucides)
  const [lip, setLip]   = useState(entry.lipides)

  // Les ~55 autres nutriments (sucres détaillés, acides gras, vitamines, minéraux...)
  // ne sont pas affichés ici pour ne pas surcharger cette mini-UI d'édition rapide,
  // mais on les garde synchronisés au prorata du grammage pour ne pas les figer/perdre
  // quand on ajuste juste la quantité.
  const extraRef = useRef({})

  // Quand le grammage change, on recalcule kcal/macros au prorata
  // à partir des valeurs d'origine de l'entrée (entry.qty_g -> entry.energie_kcal etc.)
  const handleQtyChange = (val) => {
    setQty(val)
    const newQty = parseFloat(val)
    if (!newQty || newQty <= 0 || !entry.qty_g) return
    const f = newQty / entry.qty_g
    setKcal(parseFloat((entry.energie_kcal * f).toFixed(1)))
    setProt(parseFloat((entry.proteines * f).toFixed(2)))
    setGluc(parseFloat((entry.glucides * f).toFixed(2)))
    setLip(parseFloat((entry.lipides * f).toFixed(2)))

    const next = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = entry[key]
      next[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
    }
    extraRef.current = next
  }

  const save = () => onSave({
    qty_g: parseFloat(qty) || 0,
    energie_kcal: parseFloat(kcal) || 0,
    proteines: parseFloat(prot) || 0,
    glucides: parseFloat(gluc) || 0,
    lipides: parseFloat(lip) || 0,
    ...extraRef.current,
  })

  const field = (label, val, set, color, numeric = true) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input
        type="text" inputMode={numeric ? "decimal" : "text"} value={val}
        onChange={e => set(e.target.value)}
        style={{ width: 58, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 4px', fontSize: 13, fontWeight: 600, color, background: 'var(--gray-bg)', fontFamily: 'var(--font)', outline: 'none' }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )

  return (
    <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderTop: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-dark)', marginBottom: 8 }}>{entry.food_name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 10 }}>
        {field('g', qty, handleQtyChange, 'var(--text)')}
        {field('kcal', kcal, setKcal, 'var(--text)')}
        {field('Prot.', prot, setProt, 'var(--green)')}
        {field('Gluc.', gluc, setGluc, 'var(--amber)')}
        {field('Lip.', lip, setLip, 'var(--coral)')}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} style={{ flex: 1, background: 'var(--green)', color: 'white', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Check size={14} /> Sauvegarder
        </button>
        <button onClick={onCancel} style={{ flex: 1, background: 'var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  )
}

export default function MealSection({ name, entries, onAdd, onDelete, onUpdate, onOpenDetail }) {
  const [editId, setEditId] = useState(null)
  const totalKcal = entries.reduce((s, e) => s + (e.energie_kcal || 0), 0)

  const handleSave = async (id, patch) => {
    await onUpdate(id, patch)
    setEditId(null)
  }

  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{Math.round(totalKcal)} kcal</div>
        </div>
        <button
          onClick={() => onAdd(name)}
          style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Items */}
      {entries.map(entry => (
        <div key={entry.id}>
          <div className="divider" />
          {editId === entry.id ? (
            <EditRow entry={entry} onSave={p => handleSave(entry.id, p)} onCancel={() => setEditId(null)} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', gap: 10 }}>
              <div
                onClick={() => onOpenDetail(entry)}
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.food_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {entry.qty_g}g &nbsp;·&nbsp;
                  <span className="c-prot">P {Math.round(entry.proteines || 0)}g</span>&nbsp;
                  <span className="c-gluc">G {Math.round(entry.glucides || 0)}g</span>&nbsp;
                  <span className="c-lip">L {Math.round(entry.lipides || 0)}g</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(entry.energie_kcal || 0)} kcal</span>
              <button className="btn-icon" onClick={() => setEditId(entry.id)} style={{ color: 'var(--text-hint)' }}><Pencil size={15} /></button>
              <button className="btn-icon" onClick={() => onDelete(entry.id)} style={{ color: 'var(--text-hint)' }}><Trash2 size={15} /></button>
            </div>
          )}
        </div>
      ))}

      {entries.length === 0 && (
        <div style={{ padding: '10px 14px 12px', fontSize: 13, color: 'var(--text-hint)' }}>
          Aucun aliment — appuie sur + pour ajouter
        </div>
      )}
    </div>
  )
}