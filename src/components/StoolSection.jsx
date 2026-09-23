import React, { useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Droplets } from 'lucide-react'
import { bristolType, stoolCouleur, formatHeureSelle } from '../lib/stool'

// ─────────────────────────────────────────────────────────────────────────────
// StoolSection — carte « Transit » de la page du jour, même esprit que
// SportSection (section repliable, état en localStorage, un appui pour
// ajouter). Visible uniquement pour STOOL_TRACKER_USER_ID (géré par l'appelant
// — ce composant ne connaît pas le feature flag).
//
// Props :
//   entries       — passages du jour (déjà triés)
//   onOpenSheet() — ouvre la feuille « Ajouter un passage »
//   onOpenEntry(entry) — ouvre la feuille en édition
// ─────────────────────────────────────────────────────────────────────────────
export default function StoolSection({ entries = [], onOpenSheet, onOpenEntry }) {
  const hasEntries = entries.length > 0

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stool-collapsed')) ?? false }
    catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('stool-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px' }}>
        <button
          onClick={toggleCollapsed}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, textAlign: 'left', minWidth: 0 }}
        >
          <ChevronDown
            size={16}
            color="var(--text-hint)"
            style={{ flexShrink: 0, transition: 'transform .2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Droplets size={14} color="var(--amber)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Transit</span>
              {hasEntries && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: 'var(--amber-light)', color: 'var(--amber)',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {entries.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {hasEntries ? 'Voir le détail des passages' : 'Rien noté pour ce jour'}
            </div>
          </div>
        </button>
        <button
          onClick={onOpenSheet}
          style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--amber-light)', color: 'var(--amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6,
          }}
          aria-label="Ajouter un passage"
        >
          <Plus size={17} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="divider" />
          <div style={{ padding: '10px 14px 12px' }}>
            {hasEntries ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.map((s) => {
                  const bristol = bristolType(s.bristol)
                  const couleur = stoolCouleur(s.couleur)
                  return (
                    <button
                      key={s.id}
                      onClick={() => onOpenEntry(s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '9px 11px', borderRadius: 10, background: 'var(--gray-bg)', textAlign: 'left',
                        fontFamily: 'var(--font)',
                      }}
                    >
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: bristol?.color || 'var(--border)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {s.bristol}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>
                          Type {s.bristol}{couleur ? ` · ${couleur.label}` : ''}
                        </span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatHeureSelle(s.heure) || 'Heure non notée'}
                          {s.lieu ? ` · ${s.lieu}` : ''}
                          {s.remarques?.length ? ` · ${s.remarques.length} remarque${s.remarques.length > 1 ? 's' : ''}` : ''}
                        </span>
                      </span>
                      <ChevronRight size={15} color="var(--text-hint)" style={{ flexShrink: 0 }} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Aucun passage noté pour ce jour.
              </div>
            )}

            {!hasEntries && (
              <button
                onClick={onOpenSheet}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
                  fontSize: 12, fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--font)',
                }}
              >
                <Plus size={14} /> Ajouter un passage
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
