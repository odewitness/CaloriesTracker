import React, { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import EditableFoodRow from './EditableFoodRow'

export default function MealSection({ name, entries, target, onAdd, onDelete, onUpdate, onOpenDetail }) {
  const enabled = target?.enabled !== false
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
          <EditableFoodRow
            entry={entry}
            onSave={patch => onUpdate(entry.id, patch)}
            onDelete={() => onDelete(entry.id)}
            onOpenDetail={() => onOpenDetail(entry)}
            bare
          />
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