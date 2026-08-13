import React, { useState } from 'react'
import { Plus, Trash2, Pill, Check } from 'lucide-react'
import { fmt } from '../lib/dates'

export const SUPPLEMENT_MEAL = 'Compléments'

// ── Section compléments alimentaires ──────────────────────────────────────
// Extrait de TodayPage.jsx pour être réutilisé tel quel par DayRecapPanel
// (calendrier) — même comportement (repli/dépli, ajout, suppression) sur
// les deux pages, une seule source de vérité.
// plannedSupplements — repas_planifies (meal='Compléments') non mangés,
// affichés en lignes distinctes (bordure pointillée) au-dessus des
// compléments déjà pris, avec une action de validation directe.
export default function SupplementSection({ supplements, plannedSupplements = [], onOpenModal, onAdd, onDelete, onMarkPlannedEaten, onDeletePlanned }) {
  const [collapsed, setCollapsed] = useState(false)
  const todayStr = fmt(new Date())

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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {r.nom}{missed && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', marginLeft: 6 }}>Manqué</span>}
                  </div>
                  {item && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {item.qty_g} g / ml
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
          background: 'var(--gray-bg)',
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {s.food_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {s.qty_g} g / ml
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
