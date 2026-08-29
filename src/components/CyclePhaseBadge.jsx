import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cycleInfo, cycleNutrientRows, amenorrheaNotice, estimatedIronLoss, PHASES, formatPredictionWindow } from '../lib/cycle'
import CycleNutrientTips from './CycleNutrientTips'

// ─────────────────────────────────────────────────────────────────────────────
// CyclePhaseBadge — pastille de phase sur la page du jour : phase + jour du
// cycle + fourchette estimée des prochaines règles. `kcalDelta` (Palier 3) =
// kcal ajoutées à l'objectif du jour pour la phase lutéale, affichées ici
// quand l'option est active. Si des favoris correspondent aux nutriments à
// privilégier de la phase (Palier 4), la pastille devient dépliable et
// affiche la liste « bon moment pour… ». Ne s'affiche que si le suivi de
// cycle est activé et qu'on a au moins un jour de règles saisi.
// ─────────────────────────────────────────────────────────────────────────────
export default function CyclePhaseBadge({ dateStr, days, cycleSettings, kcalDelta = 0, favorites, intensiteByDate }) {
  const cfg = cycleSettings || {}
  const [open, setOpen] = useState(false)

  if (!cfg.enabled || cfg.afficher_badge_jour === false) return null
  if (!days || days.length === 0) return null

  const info = cycleInfo(dateStr, days, cfg)
  const phase = PHASES[info.phase] || PHASES.inconnue

  const ironLoss = estimatedIronLoss(days, intensiteByDate)
  const tipRows = cycleNutrientRows(info.phase, favorites, cfg, { ironLoss })
  const expandable = tipRows.length > 0
  const notice = amenorrheaNotice(dateStr, days, cfg)

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
      style={{ padding: '10px 14px', marginBottom: 12, borderLeft: `3px solid ${phase.color}` }}
    >
      <div
        onClick={expandable ? () => setOpen(o => !o) : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: expandable ? 'pointer' : 'default' }}
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
        {expandable && (
          <ChevronDown
            size={16}
            color="var(--text-hint)"
            style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
          />
        )}
      </div>

      {notice && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)',
          fontSize: 11, lineHeight: 1.45, color: 'var(--coral)',
        }}>
          Pas de règles notées depuis {notice.days} j — si ce n'est pas un oubli de saisie,
          ça peut valoir le coup d'en parler à un·e professionnel·le de santé.
        </div>
      )}

      {expandable && open && <CycleNutrientTips rows={tipRows} />}
    </div>
  )
}
