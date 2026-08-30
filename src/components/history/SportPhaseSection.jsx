import React, { useMemo } from 'react'
import { PHASES, PHASE_SPORT_GUIDANCE, phaseForDate } from '../../lib/cycle'
import { formatDuree } from '../../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportPhaseSection — rétrospectif « Ton sport selon ta phase » dans
// l'Historique. Répartit les minutes / séances de la période par phase du
// cycle et rappelle, sous chaque phase, le repère sport correspondant
// (PHASE_SPORT_GUIDANCE — informatif, jamais prescriptif). Hors vue Année.
//
// Ne s'affiche que si : suivi de cycle actif (hors contraception), suivi sport
// actif, et au moins 3 séances rattachables à une phase sur la période.
//
// Props :
//   activites      — séances de la période (chacune { date, duree_min })
//   cycleDays      — jours de règles (useCycle().days)
//   cycleSettings  — settings.cycle
// ─────────────────────────────────────────────────────────────────────────────
const PHASE_ORDER = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale']

export default function SportPhaseSection({ activites = [], cycleDays, cycleSettings }) {
  const cfg = cycleSettings || {}
  const enabled = !!cfg.enabled && !cfg.sous_contraception && Array.isArray(cycleDays) && cycleDays.length > 0

  const byPhase = useMemo(() => {
    if (!enabled) return null
    const acc = {}
    let total = 0
    for (const a of activites) {
      const ph = phaseForDate(a.date, cycleDays, cfg)
      if (!ph || ph === 'inconnue') continue
      if (!acc[ph]) acc[ph] = { minutes: 0, seances: 0 }
      acc[ph].minutes += Number(a.duree_min) || 0
      acc[ph].seances += 1
      total += 1
    }
    return { acc, total }
  }, [enabled, activites, cycleDays, cfg])

  if (!byPhase || byPhase.total < 3) return null

  const maxMin = Math.max(1, ...PHASE_ORDER.map((k) => byPhase.acc[k]?.minutes || 0))
  const rows = PHASE_ORDER.filter((k) => byPhase.acc[k])

  return (
    <>
      <div className="section-title">Ton sport selon ta phase</div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((k) => {
            const ph = PHASES[k]
            const d = byPhase.acc[k]
            const note = PHASE_SPORT_GUIDANCE[k]?.notes
            return (
              <div key={k}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{ph.emoji}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{ph.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {formatDuree(d.minutes)} · {d.seances} séance{d.seances > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: note ? 5 : 0 }}>
                  <div style={{
                    width: `${Math.round((d.minutes / maxMin) * 100)}%`, height: '100%',
                    background: ph.color, borderRadius: 2,
                  }} />
                </div>
                {note && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-hint)', lineHeight: 1.45 }}>{note}</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.4 }}>
          Ces repères varient beaucoup d'une personne à l'autre — écoute surtout tes
          sensations. Ce n'est pas un programme à suivre.
        </div>
      </div>
    </>
  )
}
