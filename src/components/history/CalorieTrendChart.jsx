import React, { useMemo, useState, useId } from 'react'
import { Scale } from 'lucide-react'
import { dayStatus, STATUS_COLOR, smoothPath, eachDay } from '../../lib/history'

const WIDTH = 328
const HEIGHT = 182
const PAD_L = 8
const PAD_R = 8
const PAD_TOP = 18
const PAD_BOTTOM = 22
const PLOT_W = WIDTH - PAD_L - PAD_R
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM

const WEEKDAY_INITIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Graphique de tendance des calories de la période affichée.
//   - Semaine / Mois : un histogramme, une barre par jour calendaire, couleur
//     selon l'objectif (dayStatus), barre creuse pour un jour exclu, ligne
//     d'objectif en pointillés. Taper une barre → onSelect(dateStr).
//   - Année : une courbe lissée, un point par mois loggé (moyenne kcal/j du
//     mois). Taper un point → onSelect(monthKey).
// Superposition optionnelle du poids (weightPoints : [{ key, value }] où key
// correspond à un dateStr en mode barres, à un monthKey en mode courbe).
export default function CalorieTrendChart({
  tab, bounds, days, goalKcal, excludedDates,
  monthSummaries = [], avgKcal,
  weightPoints = [], showWeight, onToggleWeight, onSelect,
}) {
  const gradId = useId()
  const variant = tab === 'annee' ? 'line' : 'bars'
  const [selectedKey, setSelectedKey] = useState(null)

  const select = (key) => { setSelectedKey(key); onSelect?.(key) }

  // ── Points de données (clé + valeur kcal + exclu) ─────────────────────────
  const points = useMemo(() => {
    if (variant === 'line') {
      return monthSummaries
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(m => ({ key: m.key, value: m.avgKcal, label: m.label, excluded: false }))
    }
    return eachDay(bounds.start, bounds.end).map(dStr => {
      const es = days[dStr] || []
      const kcal = es.reduce((s, e) => s + (e.energie_kcal || 0), 0)
      const d = new Date(dStr + 'T12:00:00')
      return {
        key: dStr,
        value: kcal,
        excluded: excludedDates.has(dStr),
        dayNum: d.getDate(),
        weekdayIdx: (d.getDay() + 6) % 7,
      }
    })
  }, [variant, bounds.start, bounds.end, days, excludedDates, monthSummaries])

  const withData = points.filter(p => p.value > 0)
  const maxVal = Math.max(goalKcal, ...points.map(p => p.value), 1) * 1.12
  const yFor = (v) => PAD_TOP + (1 - v / maxVal) * PLOT_H
  const goalY = yFor(goalKcal)

  // ── Superposition poids : échelle Y secondaire indépendante ───────────────
  const weightByKey = useMemo(() => {
    const m = new Map()
    for (const w of weightPoints) m.set(w.key, w.value)
    return m
  }, [weightPoints])
  const shownWeights = points.map(p => weightByKey.get(p.key)).filter(v => v != null)
  const canWeight = weightPoints.length >= 2
  const wMin = shownWeights.length ? Math.min(...shownWeights) : 0
  const wMax = shownWeights.length ? Math.max(...shownWeights) : 1
  const wSpan = (wMax - wMin) || 1
  const wYFor = (v) => PAD_TOP + (1 - (v - (wMin - wSpan * 0.2)) / (wSpan * 1.4)) * PLOT_H

  // ── Rendu ────────────────────────────────────────────────────────────────
  const enoughForLine = variant === 'line' && withData.length >= 2
  const enoughForBars = variant === 'bars' && withData.length >= 1

  let weightPath = ''
  let weightCoords = []
  if (showWeight && canWeight) {
    weightCoords = points
      .map((p, i) => {
        const v = weightByKey.get(p.key)
        if (v == null) return null
        const x = variant === 'line'
          ? PAD_L + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W)
          : PAD_L + (i + 0.5) * (PLOT_W / points.length)
        return { x, y: wYFor(v), v }
      })
      .filter(Boolean)
    weightPath = smoothPath(weightCoords)
  }

  return (
    <div className="card" style={{ padding: '16px 14px 12px', marginBottom: 12 }}>
      {/* Moyenne de la période + bascule superposition du poids */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            {Math.round(avgKcal || 0)} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>kcal/j en moyenne</span>
          </div>
        </div>
        <button
          onClick={canWeight ? onToggleWeight : undefined}
          className="chip"
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11,
            background: showWeight && canWeight ? 'var(--purple)' : 'var(--green-light)',
            color: showWeight && canWeight ? 'white' : 'var(--green-dark)',
            opacity: canWeight ? 1 : 0.4, cursor: canWeight ? 'pointer' : 'default',
          }}
          title={canWeight ? 'Superposer la courbe de poids' : 'Pas assez de relevés de poids sur cette période'}
        >
          <Scale size={12} /> Poids
        </button>
      </div>

      {(enoughForBars || enoughForLine) ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '4px 0' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ligne d'objectif */}
          <line x1={PAD_L} y1={goalY} x2={WIDTH - PAD_R} y2={goalY} stroke="var(--text-hint)" strokeWidth="1" strokeDasharray="3 3" />

          {variant === 'bars' && points.map((p, i) => {
            const slotW = PLOT_W / points.length
            const barW = Math.max(3, slotW * 0.6)
            const cx = PAD_L + (i + 0.5) * slotW
            const top = p.value > 0 ? yFor(p.value) : HEIGHT - PAD_BOTTOM
            const h = Math.max(0, HEIGHT - PAD_BOTTOM - top)
            const status = dayStatus(p.value, goalKcal)
            const color = STATUS_COLOR[status]
            const isSel = p.key === selectedKey
            const showLabel = tab === 'semaine' || p.dayNum === 1 || p.dayNum % 5 === 0
            return (
              <g key={p.key} onClick={() => select(p.key)} style={{ cursor: 'pointer' }}>
                <rect x={cx - slotW / 2} y={PAD_TOP} width={slotW} height={PLOT_H} fill="transparent" />
                {p.value > 0 && (
                  <rect
                    x={cx - barW / 2} y={top} width={barW} height={h} rx={2}
                    fill={p.excluded ? 'transparent' : color}
                    stroke={p.excluded ? color : 'none'}
                    strokeDasharray={p.excluded ? '2 2' : undefined}
                    opacity={p.excluded ? 0.55 : (isSel ? 1 : 0.9)}
                  />
                )}
                {isSel && (
                  <rect x={cx - barW / 2 - 1.5} y={top - 1.5} width={barW + 3} height={h + 1.5} rx={3} fill="none" stroke="var(--text)" strokeWidth="1" opacity="0.4" />
                )}
                {showLabel && (
                  <text x={cx} y={HEIGHT - 7} fontSize="9" fill="var(--text-hint)" textAnchor="middle">
                    {tab === 'semaine' ? WEEKDAY_INITIAL[p.weekdayIdx] : p.dayNum}
                  </text>
                )}
              </g>
            )
          })}

          {variant === 'line' && (() => {
            const coords = points.map((p, i) => ({
              x: PAD_L + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W),
              y: yFor(p.value),
            }))
            const path = smoothPath(coords)
            const baseline = HEIGHT - PAD_BOTTOM
            const area = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`
            return (
              <>
                <path d={area} fill={`url(#${gradId})`} stroke="none" />
                <path d={path} fill="none" stroke="var(--green)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => {
                  const isSel = p.key === selectedKey
                  return (
                    <g key={p.key} onClick={() => select(p.key)} style={{ cursor: 'pointer' }}>
                      <circle cx={coords[i].x} cy={coords[i].y} r={11} fill="transparent" />
                      <circle cx={coords[i].x} cy={coords[i].y} r={isSel ? 4.5 : 2.5} fill={isSel ? 'var(--green)' : 'var(--white)'} stroke="var(--green)" strokeWidth="1.5" />
                      <text x={coords[i].x} y={HEIGHT - 7} fontSize="9" fill="var(--text-hint)" textAnchor="middle">
                        {p.label?.slice(0, 3)}
                      </text>
                    </g>
                  )
                })}
              </>
            )
          })()}

          {/* Superposition poids */}
          {showWeight && canWeight && weightCoords.length >= 2 && (
            <>
              <path d={weightPath} fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 0" />
              {weightCoords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r={2} fill="var(--purple)" />
              ))}
            </>
          )}
        </svg>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-hint)' }}>
          {variant === 'line'
            ? 'Encore un mois loggé et la courbe apparaîtra ici.'
            : 'Logge une journée pour voir apparaître le graphique.'}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-hint)', marginTop: 2 }}>
        <span>Ligne pointillée = objectif {goalKcal} kcal</span>
        {showWeight && canWeight && shownWeights.length >= 2 && (
          <span style={{ color: 'var(--purple)', fontWeight: 600 }}>Poids {wMin}–{wMax} kg</span>
        )}
      </div>
    </div>
  )
}
