import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Pill, Check, ChevronRight } from 'lucide-react'
import { fmt } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export const SUPPLEMENT_MEAL = 'Compléments'

// Retrouve un libellé de portion lisible (ex: "2 gélules") à partir des
// portions définies sur l'aliment complément (dose + portions courantes —
// voir CustomFoodsSection) et de la quantité stockée en base (grammes).
// Recalculé côté client depuis la source de vérité (aliments_custom.portions)
// plutôt que persisté à l'ajout, pour rester juste même si l'utilisateur
// modifie ses doses après coup.
function complementPortionLabel(portions, qtyG) {
  if (!Array.isArray(portions) || portions.length === 0 || qtyG == null) return null
  const exact = portions.find(p => Math.abs(p.g - qtyG) < 1e-6)
  if (exact) return exact.label
  const doseUnitG = portions[0]?.g
  if (!doseUnitG) return null
  const count = Math.round((qtyG / doseUnitG) * 100) / 100
  if (count === 1) return portions[0].label
  const noun = (portions[0].label || '').replace(/^1\s*/, '') || 'dose'
  const words = noun.split(' ')
  words[0] = /[sx]$/i.test(words[0]) ? words[0] : `${words[0]}s`
  return `${count} ${words.join(' ')}`
}

// ── Section compléments alimentaires ──────────────────────────────────────
// Extrait de TodayPage.jsx pour être réutilisé tel quel par DayRecapPanel
// (calendrier) — même comportement (repli/dépli, ajout, suppression) sur
// les deux pages, une seule source de vérité.
// plannedSupplements — repas_planifies (meal='Compléments') non mangés,
// affichés en lignes distinctes (bordure pointillée) au-dessus des
// compléments déjà pris, avec une action de validation directe.
export default function SupplementSection({ supplements, plannedSupplements = [], onOpenModal, onAdd, onDelete, onMarkPlannedEaten, onDeletePlanned, onOpenDetail, onOpenPlannedSource }) {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const todayStr = fmt(new Date())

  // Portions (dose + portions courantes) des aliments perso référencés par les
  // entrées affichées, pour reconstruire un libellé lisible ("2 gélules") au
  // lieu d'afficher les grammes bruts stockés en base.
  const [portionsById, setPortionsById] = useState({})
  const customIds = useMemo(() => {
    const ids = new Set()
    supplements.forEach(s => { if (s.food_source === 'custom' && s.food_ref_id) ids.add(s.food_ref_id) })
    plannedSupplements.forEach(r => {
      const item = (r.items || [])[0]
      if (item?.food_source === 'custom' && item.food_ref_id) ids.add(item.food_ref_id)
    })
    return [...ids].sort()
  }, [supplements, plannedSupplements])
  const customIdsKey = customIds.join(',')

  useEffect(() => {
    if (!user || customIds.length === 0) { setPortionsById({}); return }
    supabase.from('aliments_custom').select('id,portions').eq('user_id', user.id).in('id', customIds)
      .then(({ data }) => {
        const map = {}
        for (const row of (data || [])) map[row.id] = row.portions
        setPortionsById(map)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customIdsKey, user])

  const formatQty = (entry) => {
    if (entry.food_source === 'custom') {
      const label = complementPortionLabel(portionsById[entry.food_ref_id], entry.qty_g)
      if (label) return label
    }
    return `${entry.qty_g} g / ml`
  }

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 8 }}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Pill size={14} color="var(--purple, #8b5cf6)" />
          <span className="section-title" style={{ margin: 0, color: 'var(--purple, #8b5cf6)' }}>
            Compléments
          </span>
          {supplements.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: 'var(--purple-light, #ede9fe)',
              color: 'var(--purple, #8b5cf6)',
              borderRadius: 10, padding: '1px 7px',
            }}>
              {supplements.length}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 2 }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </button>

        <button
          onClick={() => onOpenModal({ meal: SUPPLEMENT_MEAL, addEntry: onAdd })}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--purple-light, #ede9fe)',
            color: 'var(--purple, #8b5cf6)',
            border: 'none', borderRadius: 8,
            padding: '5px 10px', fontSize: 12, fontWeight: 700,
            fontFamily: 'var(--font)', cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          Ajouter
        </button>
      </div>

      {plannedSupplements.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {plannedSupplements.map(r => {
            const item = (r.items || [])[0]
            const missed = !r.mange && r.date < todayStr
            const clickable = !!(onOpenPlannedSource && r.source_type)
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', marginBottom: 6,
                  border: `1px dashed ${missed ? 'var(--coral)' : 'var(--purple)'}`,
                  borderRadius: 'var(--radius-sm, 12px)',
                }}
              >
                <Pill size={13} color={missed ? 'var(--coral)' : 'var(--purple, #8b5cf6)'} style={{ flexShrink: 0 }} />
                <div
                  onClick={clickable ? () => onOpenPlannedSource(r) : undefined}
                  style={{ flex: 1, minWidth: 0, cursor: clickable ? 'pointer' : 'default' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.nom}
                    </span>
                    {missed && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', flexShrink: 0 }}>Manqué</span>}
                    {clickable && <ChevronRight size={13} color="var(--text-hint)" style={{ flexShrink: 0 }} />}
                  </div>
                  {item && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {formatQty(item)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onMarkPlannedEaten(r)}
                  className="btn-icon"
                  style={{ background: 'var(--green-light)', color: 'var(--green-dark)', flexShrink: 0 }}
                  aria-label="Marquer pris"
                  title="Marquer pris"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => onDeletePlanned(r.id)}
                  className="btn-icon"
                  style={{ color: 'var(--text-hint)', flexShrink: 0 }}
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!collapsed && (
        <div style={{
          background: 'var(--white)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-sm, 12px)',
          overflow: 'hidden',
        }}>
          {supplements.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-hint)', textAlign: 'center' }}>
              Aucun complément aujourd'hui
            </div>
          ) : (
            supplements.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '10px 14px',
                  borderBottom: i < supplements.length - 1 ? '0.5px solid var(--border)' : 'none',
                  gap: 10,
                }}
              >
                <Pill size={13} color="var(--purple, #8b5cf6)" style={{ flexShrink: 0 }} />
                <div
                  onClick={onOpenDetail ? () => onOpenDetail(s) : undefined}
                  style={{ flex: 1, minWidth: 0, cursor: onOpenDetail ? 'pointer' : 'default' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {s.food_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {formatQty(s)}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(s.id)}
                  className="btn-icon"
                  style={{ color: 'var(--text-hint)', flexShrink: 0 }}
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
