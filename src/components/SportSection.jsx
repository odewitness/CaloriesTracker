import React, { useState } from 'react'
import { Dumbbell, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import {
  sportTypeEmoji, sportTypeLabel, sportIntensiteLabel,
  formatDuree, formatHeure, dayEnergyBalance,
} from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportSection — carte « Activité » de la page du jour. Même esprit que
// WaterSection : section repliable (état mémorisé en localStorage), un appui
// pour ajouter. Liste des séances du jour + anneau « minutes actives cette
// semaine » vs objectif hebdo (Palier 2). Aucun effet sur les objectifs de
// calories.
//
// Props :
//   activites     — séances du jour (déjà triées)
//   week          — { minutes, seances, kcal } sur la semaine en cours
//   sportCfg      — settings.sport
//   consumedKcal  — kcal mangées ce jour (pour le bilan, mode_energie 'bilan')
//   maintenanceKcal — dépense d'entretien estimée (TDEE) ou null
//   adjust        — mode 'manger_selon_effort' : { delta, base, credit, goal, applied } ou null
//   onOpenSheet() — ouvre la feuille « Ajouter une séance »
//   onOpenEntry(activite) — ouvre la feuille en édition
// ─────────────────────────────────────────────────────────────────────────────
export default function SportSection({ activites = [], week, sportCfg, consumedKcal, maintenanceKcal, adjust, onOpenSheet, onOpenEntry }) {
  const goalMin = Number(sportCfg?.objectif_hebdo_minutes) || 0
  const weekMin = Math.round(week?.minutes || 0)
  const pct = goalMin > 0 ? Math.round((weekMin / goalMin) * 100) : 0
  const fillPct = Math.min(100, pct)
  const reached = goalMin > 0 && weekMin >= goalMin
  const hasEntries = activites.length > 0

  // Bilan énergétique du jour (Palier 6) — lecture seule, n'affecte pas les
  // objectifs. Affiché uniquement si l'utilisatrice a activé mode_energie 'bilan'.
  const sportKcalToday = activites.reduce((s, a) => s + (Number(a.energie_kcal) || 0), 0)
  const showBilan = sportCfg?.mode_energie === 'bilan'
  const bilan = showBilan
    ? dayEnergyBalance({ consumedKcal, maintenanceKcal, sportKcal: sportKcalToday })
    : null
  // « Manger selon l'effort » (Palier 7) — l'objectif du jour EST déjà ajusté
  // en amont (daySettings). Ici on explique seulement l'ajustement.
  const showEffort = sportCfg?.mode_energie === 'manger_selon_effort'

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
            {goalMin > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <WeekRing pct={pct} reached={reached} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{weekMin} / {goalMin} min</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {reached ? 'Objectif de la semaine atteint 🎉' : `Encore ${goalMin - weekMin} min cette semaine`}
                  </div>
                  {week?.seances ? (
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                      {week.seances} séance{week.seances > 1 ? 's' : ''}{week.kcal ? ` · ≈ ${Math.round(week.kcal)} kcal` : ''}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {goalMin === 0 && week?.seances > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginBottom: 10 }}>
                Cette semaine : {formatDuree(weekMin)} · {week.seances} séance{week.seances > 1 ? 's' : ''}
              </div>
            )}

            {showEffort && (
              <div style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Objectif du jour · manger selon l'effort
                </div>
                {adjust?.applied ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Base (jour sans séance) <strong>{adjust.base}</strong>
                      {adjust.credit > 0 ? <> + <strong>{adjust.credit}</strong> de séances</> : null}
                      {' = '}<strong style={{ color: 'var(--text)' }}>{adjust.goal} kcal</strong>
                    </div>
                    {adjust.delta !== 0 && (
                      <div style={{ fontSize: 11.5, marginTop: 3, color: adjust.delta > 0 ? 'var(--green)' : 'var(--amber)' }}>
                        {adjust.delta > 0 ? '+' : '−'}{Math.abs(adjust.delta)} kcal vs ton objectif du jour hors sport
                        {adjust.delta < 0 ? ' (rien de noté aujourd\'hui)' : ''}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Renseigne ton profil (sexe, âge, taille, poids, niveau d'activité) pour que ce mode s'applique. En attendant, ton objectif habituel est utilisé.
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.5 }}>
                  Ton objectif de base repasse à un équivalent sédentaire, et tes séances du jour se rajoutent (plafond +{sportCfg?.depense_max_creditee_kcal ?? 400}). Estimation ±25 %. Historique et calendrier gardent ton objectif à plat. Désactivable à tout moment dans Profil › Sport.
                </div>
              </div>
            )}

            {showBilan && (
              <div style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Bilan du jour · approximatif
                </div>
                {bilan ? (
                  <>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Mangé <strong>{Math.round(consumedKcal || 0)}</strong> · dépense estimée ≈{' '}
                      <strong>{bilan.depense}</strong> ({bilan.maintenance} entretien
                      {bilan.sport > 0 ? ` + ${bilan.sport} sport` : ''})
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: bilan.bilan > 0 ? 'var(--amber)' : 'var(--green)' }}>
                      {bilan.bilan >= 0 ? 'Surplus' : 'Déficit'} ≈ {Math.abs(bilan.bilan)} kcal
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    {sportKcalToday > 0
                      ? <>Dépense sport du jour ≈ <strong>{Math.round(sportKcalToday)}</strong> kcal.</>
                      : 'Pas encore de séance aujourd\'hui.'}
                    {' '}Renseigne ton profil (sexe, âge, taille, poids, niveau d'activité) pour un bilan complet.
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.5 }}>
                  Indicatif. Ta dépense d'entretien intègre déjà une part d'activité — ne cumule pas les deux dans ta tête. Ton objectif de calories ne change pas.
                </div>
              </div>
            )}

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

// Petit anneau de progression (minutes de la semaine vs objectif).
function WeekRing({ pct, reached }) {
  const size = 52, sw = 6
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--green)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .4s', opacity: reached ? 1 : 0.9 }}
      />
      <text
        x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        style={{ fontSize: 12, fontWeight: 700, fill: 'var(--green-dark)' }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
}
