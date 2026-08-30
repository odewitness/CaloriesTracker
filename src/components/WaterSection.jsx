import React, { useState, useEffect, useRef } from 'react'
import { Droplet, Plus, ChevronDown, ChevronRight, RotateCcw, Flame } from 'lucide-react'
import { WATER_DEFAULTS, waterTotalMl, litres } from '../lib/water'

// ─────────────────────────────────────────────────────────────────────────────
// WaterSection — carte "Eau" de la page du jour (et du récap calendrier).
// Même esprit que SupplementSection : un meal dédié (WATER_MEAL) affiché dans
// sa propre section repliable, placée sous les Compléments. L'accent est mis
// sur l'ajout en UN appui : la jauge se remplit avec une animation à chaque
// portion ajoutée.
//
// Props :
//   entries      — entrées journal d'hydratation du jour (déjà filtrées)
//   water        — settings.water (goal_ml, portions…)
//   beverageName — nom de la boisson par défaut, pour l'info-bulle (optionnel)
//   onQuickAdd(ml)  — ajoute `ml` de la boisson par défaut au journal
//   onUndo()        — retire la dernière entrée d'hydratation
//   onOpenSheet()   — ouvre la feuille "Ajouter de l'eau" (choix boisson/portions)
//   streakBeforeToday — nb de jours consécutifs (jusqu'à hier) où l'objectif a
//                       été atteint. null = ne pas afficher de série (slot ≠
//                       aujourd'hui). On y ajoute +1 en direct si l'objectif
//                       est atteint aujourd'hui.
//   onGoalReached()   — appelé UNE fois quand le total franchit l'objectif
//                       pendant la session (retour haptique + toast côté page).
// ─────────────────────────────────────────────────────────────────────────────
export default function WaterSection({ entries = [], water, beverageName, streakBeforeToday = null, onGoalReached, onQuickAdd, onUndo, onOpenSheet }) {
  const cfg = water || WATER_DEFAULTS
  const goalMl = cfg.goal_ml || WATER_DEFAULTS.goal_ml
  const portions = (cfg.portions && cfg.portions.length ? cfg.portions : WATER_DEFAULTS.portions).slice(0, 3)

  const totalMl = waterTotalMl(entries)
  const pct = goalMl > 0 ? Math.round((totalMl / goalMl) * 100) : 0
  const fillPct = Math.min(100, pct)
  const reached = totalMl >= goalMl && goalMl > 0
  const remainMl = Math.max(0, goalMl - totalMl)
  const hasEntries = entries.length > 0

  // Série d'hydratation : jours consécutifs avec objectif atteint, aujourd'hui
  // inclus s'il est déjà atteint. Affichée à partir de 2 jours.
  const streak = streakBeforeToday == null ? null : streakBeforeToday + (reached ? 1 : 0)

  // Célébration au franchissement de l'objectif (false → true) pendant la
  // session — jamais au montage (prevReached initialisé à l'état courant).
  const prevReached = useRef(reached)
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    if (reached && !prevReached.current) {
      setBurst((b) => b + 1)
      onGoalReached?.()
    }
    prevReached.current = reached
  }, [reached, onGoalReached])

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('water-collapsed')) ?? false }
    catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('water-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  // Rejoué à chaque ajout pour relancer les animations (bulles + étiquette).
  const [pulse, setPulse] = useState({ key: 0, ml: 0 })
  const quickAdd = (ml) => {
    setPulse((p) => ({ key: p.key + 1, ml }))
    onQuickAdd?.(ml)
  }

  return (
    <div className="card" style={{ marginTop: 20, overflow: 'hidden', position: 'relative' }}>
      {burst > 0 && (
        <div key={burst} className="water-celebrate" aria-hidden="true">
          <span>🎉</span><span>💧</span><span>✨</span>
        </div>
      )}
      {/* Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Droplet size={14} color="var(--blue)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Eau</span>
              {hasEntries && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: 'var(--blue-light)', color: 'var(--blue)',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {entries.length}
                </span>
              )}
              {streak != null && streak >= 2 && (
                <span
                  title={`${streak} jours d'affilée avec l'objectif atteint`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 11, fontWeight: 700,
                    background: 'var(--amber-light)', color: 'var(--amber)',
                    borderRadius: 10, padding: '1px 7px',
                  }}
                >
                  <Flame size={11} /> {streak} j
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {litres(totalMl)} / {litres(goalMl)} L
              <span style={{ color: 'var(--text-hint)' }}> · {pct} %</span>
            </div>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
              <div style={{
                width: `${fillPct}%`, height: '100%',
                background: reached ? 'var(--green)' : 'var(--blue)',
                borderRadius: 2, transition: 'width .3s',
              }} />
            </div>
          </div>
        </button>
        <button
          onClick={onOpenSheet}
          style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--blue-light)', color: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6,
          }}
          aria-label="Choisir une boisson et régler l'eau"
          title={beverageName ? `Boisson : ${beverageName}` : 'Choisir une boisson'}
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="divider" />
          <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Jauge */}
              <div className="water-tank" style={{ width: 84, flexShrink: 0, height: 116 }}>
                <div className="water-fill" style={{ height: `${fillPct}%` }}>
                  <svg className="water-wave" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M0 6 Q 15 0 30 6 T 60 6 T 90 6 T 120 6 V 14 H 0 Z" fill="#4C93D0" />
                  </svg>
                  <div key={pulse.key} style={{ position: 'absolute', left: 0, right: 0, bottom: 8, pointerEvents: 'none' }}>
                    {pulse.key > 0 && (
                      <>
                        <span className="water-bubble" style={{ left: 18, width: 7, height: 7, animationDelay: '0s' }} />
                        <span className="water-bubble" style={{ left: 40, width: 5, height: 5, animationDelay: '.12s' }} />
                        <span className="water-bubble" style={{ left: 56, width: 8, height: 8, animationDelay: '.05s' }} />
                      </>
                    )}
                  </div>
                </div>
                <div style={{
                  position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
                  fontSize: 14, fontWeight: 700, color: 'var(--blue-dark)',
                  textShadow: '0 1px 3px rgba(255,255,255,0.65)',
                }}>
                  {pct} %
                </div>
                <div key={pulse.key} className="water-float">
                  {pulse.key > 0 && <span>+{pulse.ml} ml</span>}
                </div>
              </div>

              {/* Portions rapides */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {portions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => quickAdd(p.ml)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                      padding: '9px 10px', borderRadius: 10, background: 'var(--blue-light)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: 8, background: 'var(--white)', flexShrink: 0,
                    }}>
                      <Plus size={15} color="var(--blue)" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--blue-dark)' }}>{p.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{p.ml} ml</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              {reached ? 'Objectif atteint, bien joué !' : `Il te reste ${litres(remainMl)} L pour atteindre ton objectif`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              {hasEntries && (
                <button
                  onClick={onUndo}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 20, background: 'var(--gray-bg)',
                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    fontFamily: 'var(--font)',
                  }}
                >
                  <RotateCcw size={13} />
                  Annuler le dernier
                </button>
              )}
              <button
                onClick={onOpenSheet}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
                  fontSize: 12, fontWeight: 600, color: 'var(--blue)', fontFamily: 'var(--font)',
                }}
              >
                Autre boisson
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
