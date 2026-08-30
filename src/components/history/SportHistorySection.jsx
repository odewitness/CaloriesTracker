import React, { useMemo, useState } from 'react'
import { Dumbbell, Timer, Flame, Footprints, Scale } from 'lucide-react'
import { eachDay, smoothPath } from '../../lib/history'
import { phaseForDate } from '../../lib/cycle'
import { weekStart, streakWeeks, formatDuree } from '../../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportHistorySection — récap sport de la période affichée dans l'Historique.
// Tuiles (temps, séances, pas moy./j, kcal dépensées) + un graphe à séries
// commutables : Minutes · Pas · Kcal dépensées, par jour (Semaine) / semaine
// (Mois) / mois (Année). Superposition possible de la courbe de poids
// (échelle Y à part) + bandes de phase lutéale en fond. Aucun jugement.
//
// Props :
//   activites   — séances de la période (chacune { date, duree_min, energie_kcal, ... })
//   pasByDate   — { 'YYYY-MM-DD': nb_pas } sur la période
//   streakRows  — séances des ~16 dernières semaines (pour la série)
//   tab         — 'semaine' | 'mois' | 'annee'
//   bounds      — { start, end } 'YYYY-MM-DD'
//   goalMin     — settings.sport.objectif_hebdo_minutes (0 = pas d'objectif)
//   weightPoints — [{ key, value }] (key = dateStr ou 'YYYY-MM')
//   cycleDays / cycleSettings — pour les bandes de phase lutéale
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const SERIES = [
  { key: 'minutes', label: 'Minutes', color: 'var(--green)', unit: 'min actives' },
  { key: 'pas', label: 'Pas', color: 'var(--blue)', unit: 'pas / jour' },
  { key: 'kcal', label: 'Kcal dépensées', color: 'var(--amber)', unit: 'kcal dépensées' },
]

const W = 328, H = 150, PL = 8, PR = 8, PT = 12, PB = 20
const PLOT_W = W - PL - PR
const PLOT_H = H - PT - PB
const BASE = H - PB

export default function SportHistorySection({
  activites = [], pasByDate = {}, streakRows = [], tab, bounds, goalMin = 0,
  weightPoints = [], cycleDays, cycleSettings,
}) {
  const [seriesKey, setSeriesKey] = useState('minutes')
  const [showWeight, setShowWeight] = useState(false)
  const series = SERIES.find(s => s.key === seriesKey) || SERIES[0]

  // ── Agrégats par date ────────────────────────────────────────────────────
  const { minByDate, kcalByDate } = useMemo(() => {
    const m = {}, k = {}
    for (const a of activites) {
      m[a.date] = (m[a.date] || 0) + (Number(a.duree_min) || 0)
      k[a.date] = (k[a.date] || 0) + (Number(a.energie_kcal) || 0)
    }
    return { minByDate: m, kcalByDate: k }
  }, [activites])

  const totalMin = activites.reduce((s, a) => s + (Number(a.duree_min) || 0), 0)
  const seances = activites.length
  const kcalTotal = Math.round(activites.reduce((s, a) => s + (Number(a.energie_kcal) || 0), 0))
  const pasVals = Object.values(pasByDate).filter(v => v > 0)
  const pasMeanDay = pasVals.length ? Math.round(pasVals.reduce((s, v) => s + v, 0) / pasVals.length) : 0
  const pasDays = pasVals.length

  const streak = useMemo(
    () => streakWeeks(streakRows, bounds.end, goalMin),
    [streakRows, bounds.end, goalMin],
  )

  // ── Tranches (jour / semaine / mois) + date-milieu de tranche ─────────────
  const buckets = useMemo(() => {
    const days = eachDay(bounds.start, bounds.end)
    const mid = (arr) => arr[Math.floor(arr.length / 2)] || arr[0]
    if (tab === 'annee') {
      return MONTH_INITIALS.map((label, i) => {
        const mm = String(i + 1).padStart(2, '0')
        const members = days.filter(d => d.slice(5, 7) === mm)
        return { key: mm, label, midDate: mid(members) || `${bounds.start.slice(0, 4)}-${mm}-15`, memberDates: members }
      })
    }
    if (tab === 'mois') {
      const byWeek = {}
      for (const d of days) (byWeek[weekStart(d)] ||= []).push(d)
      return Object.keys(byWeek).sort().map((ws, i) => ({
        key: ws, label: `S${i + 1}`, midDate: mid(byWeek[ws]), memberDates: byWeek[ws],
      }))
    }
    return days.map((d) => {
      const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7
      return { key: d, label: WEEKDAY_INITIALS[wd], midDate: d, memberDates: [d] }
    })
  }, [tab, bounds.start, bounds.end])

  const valueOf = (b) => {
    if (seriesKey === 'minutes') return b.memberDates.reduce((s, d) => s + (minByDate[d] || 0), 0)
    if (seriesKey === 'kcal') return b.memberDates.reduce((s, d) => s + (kcalByDate[d] || 0), 0)
    const vs = b.memberDates.map(d => pasByDate[d]).filter(v => v > 0)
    return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0
  }
  const barVals = buckets.map(valueOf)
  const maxVal = Math.max(1, ...barVals)
  const slotW = PLOT_W / (buckets.length || 1)
  const xFor = (i) => PL + (i + 0.5) * slotW
  const yFor = (v) => PT + (1 - v / maxVal) * PLOT_H

  // ── Superposition poids (échelle Y secondaire, relevé le plus proche) ─────
  const sortedW = useMemo(
    () => [...weightPoints].filter(w => w.value != null).sort((a, b) => a.key.localeCompare(b.key)),
    [weightPoints],
  )
  const canWeight = sortedW.length >= 2
  const normKey = (k) => (k && k.length === 7 ? `${k}-15` : k)
  const weightNear = (midDate) => {
    if (!sortedW.length || !midDate) return null
    const t = new Date(midDate + 'T12:00:00').getTime()
    const maxDist = (tab === 'annee' ? 31 : 21) * 86400000
    let best = null, bd = Infinity
    for (const w of sortedW) {
      const dist = Math.abs(new Date(normKey(w.key) + 'T12:00:00').getTime() - t)
      if (dist < bd) { bd = dist; best = w }
    }
    return best && bd <= maxDist ? best.value : null
  }
  const wPerBucket = useMemo(
    () => (showWeight && canWeight ? buckets.map(b => weightNear(b.midDate)) : []),
    [showWeight, canWeight, buckets, sortedW], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const shownW = wPerBucket.filter(v => v != null)
  const wMin = shownW.length ? Math.min(...shownW) : 0
  const wMax = shownW.length ? Math.max(...shownW) : 1
  const wSpan = (wMax - wMin) || 1
  const wYFor = (v) => PT + (1 - (v - (wMin - wSpan * 0.2)) / (wSpan * 1.4)) * PLOT_H
  const weightCoords = wPerBucket
    .map((v, i) => (v == null ? null : { x: xFor(i), y: wYFor(v) }))
    .filter(Boolean)

  // ── Bandes phase lutéale (fond) — quand poids superposé + cycle actif ────
  const showLuteal = showWeight && canWeight && tab !== 'annee'
    && !!cycleSettings?.enabled && !cycleSettings?.sous_contraception
    && Array.isArray(cycleDays) && cycleDays.length > 0
  const lutealIdx = useMemo(() => {
    if (!showLuteal) return []
    return buckets.map((b, i) => (phaseForDate(b.midDate, cycleDays, cycleSettings) === 'luteale' ? i : -1)).filter(i => i >= 0)
  }, [showLuteal, buckets, cycleDays, cycleSettings])

  // ── Rendu ────────────────────────────────────────────────────────────────
  if (seances === 0 && pasDays === 0) {
    return (
      <>
        <div className="section-title">Sport &amp; pas</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          Aucune séance ni pas noté sur cette période.
        </div>
      </>
    )
  }

  const tiles = [
    { icon: <Timer size={16} />, color: 'var(--green)', val: formatDuree(totalMin), label: 'Temps total' },
    { icon: <Dumbbell size={16} />, color: 'var(--blue)', val: `${seances}`, label: seances > 1 ? 'Séances' : 'Séance' },
    { icon: <Footprints size={16} />, color: 'var(--blue)', val: pasMeanDay ? pasMeanDay.toLocaleString('fr-FR') : '—', label: 'Pas moy./j' },
    { icon: <Flame size={16} />, color: 'var(--amber)', val: kcalTotal ? `≈ ${kcalTotal.toLocaleString('fr-FR')}` : '—', label: 'Kcal dépensées' },
  ]

  const bucketUnit = tab === 'annee' ? 'par mois' : tab === 'mois' ? 'par semaine' : 'par jour'

  return (
    <>
      <div className="section-title">Sport &amp; pas</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
        {tiles.map((t) => (
          <div key={t.label} className="card" style={{ padding: '12px 6px', textAlign: 'center' }}>
            <div style={{ color: t.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{t.val}</div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '12px 12px 10px', marginBottom: 16 }}>
        {/* Sélecteur de série + bascule poids */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {SERIES.map((s) => {
            const active = s.key === seriesKey
            return (
              <button
                key={s.key}
                onClick={() => setSeriesKey(s.key)}
                className="chip"
                style={{
                  fontSize: 11, padding: '4px 9px',
                  background: active ? s.color : 'var(--gray-bg)',
                  color: active ? 'white' : 'var(--text-muted)',
                }}
              >
                {s.label}
              </button>
            )
          })}
          <button
            onClick={canWeight ? () => setShowWeight(v => !v) : undefined}
            className="chip"
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, marginLeft: 'auto',
              background: showWeight && canWeight ? 'var(--purple)' : 'var(--gray-bg)',
              color: showWeight && canWeight ? 'white' : 'var(--text-muted)',
              opacity: canWeight ? 1 : 0.4, cursor: canWeight ? 'pointer' : 'default',
            }}
            title={canWeight ? 'Superposer la courbe de poids' : 'Pas assez de relevés de poids sur cette période'}
          >
            <Scale size={12} /> Poids
          </button>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Bandes phase lutéale */}
          {lutealIdx.map(i => (
            <rect key={`lb${i}`} x={(xFor(i) - slotW / 2).toFixed(1)} y={PT} width={slotW.toFixed(1)} height={PLOT_H} fill="var(--purple)" opacity="0.09" />
          ))}

          {/* Barres */}
          {buckets.map((b, i) => {
            const v = barVals[i]
            const barW = Math.max(3, slotW * 0.6)
            const cx = xFor(i)
            const top = v > 0 ? yFor(v) : BASE
            const h = Math.max(0, BASE - top)
            return (
              <g key={b.key}>
                {v > 0 && (
                  <rect
                    x={cx - barW / 2} y={top} width={barW} height={h} rx={2}
                    fill={series.color} opacity={0.85}
                  >
                    <title>{series.key === 'pas' ? `${Math.round(v).toLocaleString('fr-FR')} pas/j` : series.key === 'kcal' ? `≈ ${Math.round(v)} kcal` : `${Math.round(v)} min`}</title>
                  </rect>
                )}
                <text x={cx} y={H - 6} fontSize="9" fill="var(--text-hint)" textAnchor="middle">{b.label}</text>
              </g>
            )
          })}

          {/* Superposition poids */}
          {showWeight && canWeight && weightCoords.length >= 2 && (
            <>
              <path d={smoothPath(weightCoords)} fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {weightCoords.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={2} fill="var(--purple)" />)}
            </>
          )}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-hint)', marginTop: 4, gap: 8 }}>
          <span>{series.unit} {bucketUnit}</span>
          {showWeight && canWeight && shownW.length >= 2 && (
            <span style={{ color: 'var(--purple)', fontWeight: 600, whiteSpace: 'nowrap' }}>Poids {wMin}–{wMax} kg</span>
          )}
        </div>
        {goalMin > 0 && streak > 0 && (
          <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 4 }}>
            {streak} semaine{streak > 1 ? 's' : ''} de suite dans l'objectif de minutes.
          </div>
        )}
        {showLuteal && lutealIdx.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 4, color: 'var(--text-hint)' }}>
            <span style={{ width: 16, height: 9, borderRadius: 2, background: 'var(--purple)', opacity: 0.16, flexShrink: 0 }} />
            Bandes = phase lutéale : le poids peut monter de 0,5 à 2 kg d'eau.
          </div>
        )}
      </div>
    </>
  )
}
