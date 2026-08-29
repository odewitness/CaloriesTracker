import React, { useMemo, useState } from 'react'
import { HeartPulse, Trash2, Info } from 'lucide-react'
import { Row, ToggleSwitch, Stepper, SectionScreen } from './primitives'
import CalendarMonthGrid, { buildMonthCells } from '../CalendarMonthGrid'
import { useCycle } from '../../hooks/useCycle'
import { fmt, todayStr } from '../../lib/dates'
import {
  cycleInfo, phasesForRange, PHASES, formatPredictionWindow, formatDateRange,
  addDays, daysBetween,
} from '../../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// Écran de détail « Cycle & alimentation ».
// Palier 1 : activer/désactiver, marquer à la main TOUS les jours de règles
// (dont plusieurs cycles passés), voir la phase courante, régler les longueurs.
// Aucun changement des cibles caloriques (ce sera le Palier 3).
// Voir docs/cycle-menstruel.md.
// ─────────────────────────────────────────────────────────────────────────────
export default function CycleSection({ cycle, onPatch, onBack }) {
  const cfg = cycle || {}
  const { days, blocks, loading, toggleDay, removeDays } = useCycle()
  const [monthAnchor, setMonthAnchor] = useState(new Date())

  const today = todayStr()
  const info = useMemo(() => cycleInfo(today, days, cfg), [today, days, cfg])

  const cycleByDate = useMemo(() => {
    if (cfg.afficher_sur_calendrier === false) return undefined
    const cells = buildMonthCells(monthAnchor)
    if (!cells.length) return {}
    return phasesForRange(fmt(cells[0].date), fmt(cells[cells.length - 1].date), days, cfg)
  }, [monthAnchor, days, cfg])

  const selectedDates = useMemo(() => new Set(days), [days])

  // Blocs de règles, du plus récent au plus ancien, avec l'écart (cycle) au
  // bloc précédent.
  const rows = useMemo(() => (
    blocks.map((b, i) => ({
      ...b,
      gap: i > 0 ? daysBetween(blocks[i - 1].start, b.start) : null,
    })).reverse()
  ), [blocks])

  const removeBlock = (b) => {
    const list = []
    let cur = b.start
    while (cur <= b.end) { list.push(cur); cur = addDays(cur, 1) }
    removeDays(list)
  }

  const enabled = !!cfg.enabled

  return (
    <SectionScreen title="Cycle & alimentation" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <Row icon={<HeartPulse size={18} />} label="Activer le suivi du cycle">
          <ToggleSwitch checked={enabled} onClick={() => onPatch({ enabled: !enabled })} />
        </Row>
      </div>

      {!enabled && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Tu marques toi-même tes jours de règles (l'app ne se synchronise avec
          aucune autre appli). CaloriesTracker en déduit la phase de ton cycle et
          te montre, sans rien t'imposer, quelques repères d'alimentation adaptés.
          Les effets connus sont réels mais modestes.
        </div>
      )}

      {enabled && (
        <>
          <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <Row label="Je suis sous contraception hormonale">
              <ToggleSwitch
                checked={!!cfg.sous_contraception}
                onClick={() => onPatch({ sous_contraception: !cfg.sous_contraception })}
              />
            </Row>
            {cfg.sous_contraception && (
              <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5 }}>
                Le cycle naturel ne s'exprime pas : on garde seulement le suivi des
                jours de règles, sans calcul de phases.
              </div>
            )}
          </div>

          {/* Phase courante */}
          <PhaseSummary info={info} sousContraception={!!cfg.sous_contraception} />

          {/* Saisie / historique */}
          <div className="section-title" style={{ marginTop: 8 }}>Tes règles</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 8 }}>
            Touche chaque jour de règles pour le marquer (ou l'enlever). Marque
            plusieurs cycles passés — au moins 3 — pour des estimations fiables.
          </div>
          <CalendarMonthGrid
            monthDate={monthAnchor}
            onChangeMonth={(dir) => setMonthAnchor(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))}
            selectedDates={selectedDates}
            onToggleDate={(d) => toggleDay(d)}
            cycleByDate={cycleByDate}
          />

          {!loading && rows.length > 0 && (
            <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
              {rows.map((b) => (
                <div key={b.start} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--coral)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDateRange(b.start, b.end)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                      {b.length} jour{b.length > 1 ? 's' : ''}{b.gap != null ? ` · cycle de ${b.gap} j` : ''}
                    </div>
                  </div>
                  <button onClick={() => removeBlock(b)} aria-label="Supprimer" style={{ padding: 4, color: 'var(--text-hint)', background: 'none' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Réglages fins */}
          <div className="section-title">Réglages</div>
          <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
            <Row label="Longueur de cycle automatique">
              <ToggleSwitch
                checked={cfg.auto_longueur_cycle !== false}
                onClick={() => onPatch({ auto_longueur_cycle: !(cfg.auto_longueur_cycle !== false) })}
              />
            </Row>
            {cfg.auto_longueur_cycle === false && (
              <Row label="Longueur de cycle">
                <Stepper
                  value={cfg.longueur_cycle ?? 28}
                  display={`${cfg.longueur_cycle ?? 28} j`}
                  min={21} max={40}
                  onDec={() => onPatch({ longueur_cycle: Math.max(21, (cfg.longueur_cycle ?? 28) - 1) })}
                  onInc={() => onPatch({ longueur_cycle: Math.min(40, (cfg.longueur_cycle ?? 28) + 1) })}
                />
              </Row>
            )}
            <Row label="Durée de la phase lutéale">
              <Stepper
                value={cfg.longueur_luteale ?? 14}
                display={`${cfg.longueur_luteale ?? 14} j`}
                min={10} max={16}
                onDec={() => onPatch({ longueur_luteale: Math.max(10, (cfg.longueur_luteale ?? 14) - 1) })}
                onInc={() => onPatch({ longueur_luteale: Math.min(16, (cfg.longueur_luteale ?? 14) + 1) })}
              />
            </Row>
            <Row label="Durée des règles (si un jour n'est pas encore marqué)">
              <Stepper
                value={cfg.longueur_regles ?? 5}
                display={`${cfg.longueur_regles ?? 5} j`}
                min={2} max={8}
                onDec={() => onPatch({ longueur_regles: Math.max(2, (cfg.longueur_regles ?? 5) - 1) })}
                onInc={() => onPatch({ longueur_regles: Math.min(8, (cfg.longueur_regles ?? 5) + 1) })}
              />
            </Row>
          </div>

          <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <Row label="Pastille sur la page du jour">
              <ToggleSwitch
                checked={cfg.afficher_badge_jour !== false}
                onClick={() => onPatch({ afficher_badge_jour: !(cfg.afficher_badge_jour !== false) })}
              />
            </Row>
            <Row label="Colorer le calendrier">
              <ToggleSwitch
                checked={cfg.afficher_sur_calendrier !== false}
                onClick={() => onPatch({ afficher_sur_calendrier: !(cfg.afficher_sur_calendrier !== false) })}
              />
            </Row>
          </div>

          <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.55, marginBottom: 24 }}>
            <Info size={26} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Ces repères sont indicatifs, pas un avis médical, et ne servent ni de
              contraception ni de suivi de fertilité. Les dates sont des estimations
              (± quelques jours). L'idée est d'<strong>ajouter</strong> un peu en phase
              lutéale, jamais de te restreindre le reste du temps. Aucune
              supplémentation (fer, vitamine D, B6…) ne se décide sans bilan sanguin.
            </span>
          </div>
        </>
      )}
    </SectionScreen>
  )
}

function PhaseSummary({ info, sousContraception }) {
  const phase = PHASES[info.phase] || PHASES.inconnue
  let line2 = null
  if (info.phase === 'inconnue') {
    line2 = info.reason === 'no-data'
      ? 'Marque au moins un jour de règles ci-dessous.'
      : info.overdueBy > 0
        ? `Prochaines règles estimées dépassées de ${info.overdueBy} j.`
        : 'En attente de tes prochaines règles.'
  } else if (sousContraception) {
    line2 = 'Suivi des règles seul (contraception hormonale).'
  } else {
    const win = formatPredictionWindow(info.nextStartFrom, info.nextStartTo)
    const fiab = { bonne: 'estimation fiable', moyenne: 'estimation approximative', faible: 'estimation peu fiable' }[info.fiabilite]
    line2 = `Prochaines règles ~ ${win} · ${fiab}`
  }

  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 16, borderLeft: `3px solid ${phase.color}` }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {phase.emoji} {phase.label}
        {info.phase !== 'inconnue' && (
          <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}> · jour {info.jourCycle}</span>
        )}
      </div>
      {line2 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{line2}</div>}
      {phase.tagline && info.phase !== 'inconnue' && (
        <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.5 }}>{phase.tagline}</div>
      )}
      {(info.observedCycleLen != null || info.observedPeriodLen != null) && (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
          {info.observedCycleLen != null && `Cycle observé : ${info.observedCycleLen} j`}
          {info.observedCycleLen != null && info.observedPeriodLen != null && ' · '}
          {info.observedPeriodLen != null && `règles : ${info.observedPeriodLen} j`}
          {info.nCycles > 0 && ` (sur ${info.nCycles} cycle${info.nCycles > 1 ? 's' : ''})`}
        </div>
      )}
    </div>
  )
}
