import React from 'react'
import { cycleInfo, PHASES, formatPredictionWindow } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// CyclePhaseBadge — pastille discrète sur la page du jour : phase + jour du
// cycle + fourchette estimée des prochaines règles. `kcalDelta` (Palier 3) =
// kcal ajoutées à l'objectif du jour pour la phase lutéale, affichées ici
// quand l'option est active. Ne s'affiche que si le suivi de cycle est activé
// et qu'on a au moins un jour de règles saisi.
// ─────────────────────────────────────────────────────────────────────────────
export default function CyclePhaseBadge({ dateStr, days, cycleSettings, kcalDelta = 0 }) {
  const cfg = cycleSettings || {}
  if (!cfg.enabled || cfg.afficher_badge_jour === false) return null
  if (!days || days.length === 0) return null

  const info = cycleInfo(dateStr, days, cfg)
  const phase = PHASES[info.phase] || PHASES.inconnue

  let sub = null
  if (info.phase === 'inconnue') {
    sub = info.overdueBy > 0
      ? `Prochaines règles estimées dépassées de ${info.overdueBy} j — pense à noter le 1er jour`
      : 'Note le 1er jour de tes prochaines règles'
  } else if (cfg.sous_contraception) {
    sub = 'Sous contraception — suivi des règles seul'
  } else {
    const win = formatPredictionWindow(info.nextStartFrom, info.nextStartTo)
    const fiab = info.fiabilite === 'bonne' ? '' : ' · estimation peu fiable'
    sub = `Prochaines règles ~ ${win}${fiab}`
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', marginBottom: 12,
        borderLeft: `3px solid ${phase.color}`,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{phase.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          {phase.label}
          {info.phase !== 'inconnue' && (
            <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}> · J{info.jourCycle}</span>
          )}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub}
          </div>
        )}
      </div>
      {kcalDelta > 0 && (
        <span
          className="chip"
          style={{ flexShrink: 0, background: 'var(--purple-light, #ede9fe)', color: 'var(--purple, #8b5cf6)', fontSize: 11, fontWeight: 700 }}
          title="Objectif calorique du jour relevé pour la phase lutéale"
        >
          +{kcalDelta} kcal
        </span>
      )}
    </div>
  )
}
