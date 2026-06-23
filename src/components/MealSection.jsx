import React, { useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'

function EditRow({ entry, onSave, onCancel }) {
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

export default function MealSection({ name, entries, target, onAdd, onDelete, onUpdate, onOpenDetail }) {
  const enabled = target?.enabled !== false
  const [editId, setEditId] = useState(null)
  const storageKey = `meal-collapsed:${name}`
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) ?? false }
    catch { return false }
  })

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const totalKcal = entries.reduce((s, e) => s + (e.energie_kcal || 0), 0)
  const totalProt = entries.reduce((s, e) => s + (e.proteines || 0), 0)
  const totalGluc = entries.reduce((s, e) => s + (e.glucides || 0), 0)
  const totalLip  = entries.reduce((s, e) => s + (e.lipides || 0), 0)

  const handleSave = async (id, patch) => {
    await onUpdate(id, patch)
    setEditId(null)
  }

  // ── Repas désactivé : carte compacte grisée ───────────────────────────
  if (!enabled) {
    return (
      <div className="card" style={{ marginBottom: 10, overflow: 'hidden', opacity: 0.45 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)' }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>
              Désactivé · {entries.length > 0 ? `${Math.round(totalKcal)} kcal enregistrées` : 'Aucun aliment'}
            </div>
          </div>
          <button
            onClick={() => onAdd(name)}
            style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-bg)', color: 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── Repas actif ───────────────────────────────────────────────────────
  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
        <button
          onClick={toggleCollapsed}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, textAlign: 'left' }}
        >
          <ChevronDown
            size={16}
            color="var(--text-hint)"
            style={{ flexShrink: 0, transition: 'transform .2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {Math.round(totalKcal)}{target ? ` / ${target.kcal}` : ''} kcal
              {collapsed && entries.length > 0 && (
                <span style={{ color: 'var(--text-hint)' }}> · {entries.length} aliment{entries.length > 1 ? 's' : ''}</span>
              )}
            </div>
            {target && (
              <>
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
                  <div style={{
                    width: `${target.kcal > 0 ? Math.min(100, (totalKcal / target.kcal) * 100) : 0}%`,
                    height: '100%',
                    background: totalKcal > target.kcal ? 'var(--coral)' : 'var(--green)',
                    borderRadius: 2,
                    transition: 'width .3s',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
                  <span className="c-prot">P {Math.round(totalProt)}/{target.prot}g</span>
                  {' · '}
                  <span className="c-gluc">G {Math.round(totalGluc)}/{target.gluc}g</span>
                  {' · '}
                  <span className="c-lip">L {Math.round(totalLip)}/{target.lip}g</span>
                </div>
              </>
            )}
          </div>
        </button>
        <button
          onClick={() => onAdd(name)}
          style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Items */}
      {!collapsed && entries.map(entry => (
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

      {!collapsed && entries.length === 0 && (
        <div style={{ padding: '10px 14px 12px', fontSize: 13, color: 'var(--text-hint)' }}>
          Aucun aliment — appuie sur + pour ajouter
        </div>
      )}
    </div>
  )
}