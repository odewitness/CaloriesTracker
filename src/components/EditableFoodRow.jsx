import React, { useState, useRef } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// EditableFoodRow — ligne d'aliment/ingrédient avec édition inline du grammage.
//
// Généralisé à partir de l'EditRow qui n'existait que dans MealSection.jsx
// (pour les entrées du journal) — désormais utilisé aussi par RecipeFormModal
// pour la liste d'ingrédients d'une recette, avec exactement le même
// comportement : modifier le grammage reproportionne kcal/P/G/L (et tous les
// nutriments détaillés) automatiquement.
//
// Props :
//   entry        — { food_name, qty_g, energie_kcal, proteines, glucides, lipides, ... }
//   onSave(patch) — si fourni, affiche le crayon et permet l'édition inline
//   onDelete()    — si fourni, affiche le bouton de suppression
//   onOpenDetail()— si fourni, la ligne (hors édition) devient cliquable
//   bare          — true : pas de "card" ni de padding externe (le parent gère déjà
//                   sa propre carte/diviseur, ex: MealSection). false (défaut) :
//                   la ligne s'affiche comme une carte autonome (ex: RecipeFormModal).
// ─────────────────────────────────────────────────────────────────────────────

function EditForm({ entry, onSave, onCancel }) {
  useBackButton(onCancel)
  const [qty, setQty] = useState(String(entry.qty_g))
  const [kcal, setKcal] = useState(entry.energie_kcal)
  const [prot, setProt] = useState(entry.proteines)
  const [gluc, setGluc] = useState(entry.glucides)
  const [lip, setLip]   = useState(entry.lipides)

  const extraRef = useRef({})

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

  const field = (label, val, set, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input
        type="text" inputMode="decimal" value={val}
        onChange={e => set(e.target.value)}
        style={{ width: 58, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 4px', fontSize: 13, fontWeight: 600, color, background: 'var(--gray-bg)', fontFamily: 'var(--font)', outline: 'none' }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )

  return (
    <div style={{ padding: '10px 14px', background: 'var(--green-light)', borderRadius: 10 }}>
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

export default function EditableFoodRow({ entry, onSave, onDelete, onOpenDetail, bare = false }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <EditForm
        entry={entry}
        onSave={async patch => { await onSave(patch); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const content = (
    <>
      <div
        onClick={onOpenDetail}
        style={{ flex: 1, minWidth: 0, cursor: onOpenDetail ? 'pointer' : 'default' }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.food_name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {entry.qty_g}g &nbsp;·&nbsp;
          <span className="c-prot">P {Math.round(entry.proteines || 0)}g</span>&nbsp;
          <span className="c-gluc">G {Math.round(entry.glucides || 0)}g</span>&nbsp;
          <span className="c-lip">L {Math.round(entry.lipides || 0)}g</span>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(entry.energie_kcal || 0)} kcal</span>
      {onSave && (
        <button className="btn-icon" onClick={() => setEditing(true)} style={{ color: 'var(--text-hint)' }}><Pencil size={15} /></button>
      )}
      {onDelete && (
        <button className="btn-icon" onClick={onDelete} style={{ color: 'var(--text-hint)' }}><Trash2 size={15} /></button>
      )}
    </>
  )

  if (bare) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', gap: 10 }}>
        {content}
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {content}
    </div>
  )
}
