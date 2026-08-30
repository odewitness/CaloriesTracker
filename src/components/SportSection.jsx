import React, { useState } from 'react'
import { Dumbbell, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import {
  sportTypeEmoji, sportTypeLabel, sportIntensiteLabel,
  formatDuree, formatHeure,
} from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportSection — carte « Activité » de la page du jour. Même esprit que
// WaterSection : section repliable (état mémorisé en localStorage), un appui
// pour ajouter. Au Palier 1 : liste des séances du jour + total de la semaine
// (facultativement comparé à un objectif hebdo de minutes). Aucun effet sur les
// objectifs de calories.
//
// Props :
//   activites     — séances du jour (déjà triées)
//   week          — { minutes, seances, kcal } sur la semaine en cours
//   sportCfg      — settings.sport
//   onOpenSheet() — ouvre la feuille « Ajouter une séance »
//   onOpenEntry(activite) — ouvre la feuille en édition
// ─────────────────────────────────────────────────────────────────────────────
export default function SportSection({ activites = [], week, sportCfg, onOpenSheet, onOpenEntry }) {
  const goalMin = Number(sportCfg?.objectif_hebdo_minutes) || 0
  const weekMin = Math.round(week?.minutes || 0)
  const pct = goalMin > 0 ? Math.round((weekMin / goalMin) * 100) : 0
  const fillPct = Math.min(100, pct)
  const reached = goalMin > 0 && weekMin >= goalMin
  const hasEntries = activites.length > 0

  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sport-collapsed')) ?? false }
    catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('sport-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  const subline = goalMin > 0
    ? <>{weekMin} / {goalMin} min <span style={{ color: 'var(--text-hint)' }}>cette semaine · {pct} %</span></>
    : <>{weekMin === 0 ? 'Rien cette semaine' : `${formatDuree(weekMin)} cette semaine`}
        {week?.seances ? <span style={{ color: 'var(--text-hint)' }}> · {week.seances} séance{week.seances > 1 ? 's' : ''}</span> : null}</>

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dumbbell size={14} color="var(--green)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Activité</span>
              {hasEntries && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: 'var(--green-light)', color: 'var(--green-dark)',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {activites.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subline}</div>
            {goalMin > 0 && (
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
                <div style={{
                  width: `${fillPct}%`, height: '100%',
                  background: 'var(--green)', opacity: reached ? 1 : 0.7,
                  borderRadius: 2, transition: 'width .3s',
                }} />
              </div>
            )}
          </div>
        </button>
        <button
          onClick={onOpenSheet}
          style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6,
          }}
          aria-label="Ajouter une séance"
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
                {activites.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpenEntry(a)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 11px', borderRadius: 10, background: 'var(--gray-bg)', textAlign: 'left',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <span style={{ fontSize: 17, flexShrink: 0 }}>{sportTypeEmoji(a.type)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{sportTypeLabel(a.type)}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDuree(a.duree_min)}
                        {a.distance_km ? ` · ${a.distance_km} km` : ''}
                        {sportIntensiteLabel(a.intensite) ? ` · ${sportIntensiteLabel(a.intensite).toLowerCase()}` : ''}
                        {formatHeure(a.heure_debut) ? ` · ${formatHeure(a.heure_debut)}` : ''}
                      </span>
                    </span>
                    {a.energie_kcal != null && (
                      <span style={{ fontSize: 11.5, color: 'var(--text-hint)', flexShrink: 0 }}>≈ {Math.round(a.energie_kcal)} kcal</span>
                    )}
                    <ChevronRight size={15} color="var(--text-hint)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Aucune séance notée pour ce jour.
              </div>
            )}

            <button
              onClick={onOpenSheet}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
                fontSize: 12, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font)',
              }}
            >
              <Plus size={14} /> Ajouter une séance
            </button>
          </div>
        </>
      )}
    </div>
  )
}
