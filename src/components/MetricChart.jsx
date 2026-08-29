import React, { useState, useEffect, useMemo, useId } from 'react'
import { phaseForDate } from '../lib/cycle'

const WIDTH = 320
const HEIGHT = 170
const PAD_X = 10
const PAD_TOP = 18
const PAD_BOTTOM = 26

const RANGES = [
  { key: '1m',   label: '1 mois', months: 1 },
  { key: '3m',   label: '3 mois', months: 3 },
  { key: '6m',   label: '6 mois', months: 6 },
  { key: '1a',   label: '1 an',   months: 12 },
  { key: 'tout', label: 'Tout',   months: null },
]

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function cutoffDate(months) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

// Lisse la ligne avec des courbes de Bézier (Catmull-Rom → cubique) plutôt que
// des segments droits, pour un rendu plus proche des apps santé/sport
// (Apple Santé, Withings...).
function smoothPath(coords) {
  if (coords.length < 2) return ''
  if (coords.length === 2) return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`
  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

// Graphique d'une seule métrique (poids OU une mensuration — jamais mélangées),
// avec sélecteur de période, courbe lissée + dégradé, point tapable pour
// épingler une valeur, et écart vs le tout premier relevé de cette métrique.
export default function MetricChart({
  entries, fieldKey, label, unit, color = 'var(--green)',
  showCyclePhases = false, cycleDays, cycleSettings,
}) {
  const gradId = useId()
  const [range, setRange] = useState('tout')

  const allPoints = useMemo(() => (
    entries
      .filter(e => e[fieldKey] != null)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [entries, fieldKey])

  const rangeMonths = RANGES.find(r => r.key === range)?.months
  const points = useMemo(() => {
    if (!rangeMonths) return allPoints
    const cutoff = cutoffDate(rangeMonths)
    return allPoints.filter(p => p.date >= cutoff)
  }, [allPoints, rangeMonths])

  const [selected, setSelected] = useState(points.length - 1)
  useEffect(() => { setSelected(points.length - 1) }, [points.length, fieldKey, range])

  if (allPoints.length === 0) return null

  const selectedIndex = Math.min(Math.max(selected, 0), points.length - 1)
  const selectedPoint = points[selectedIndex]
  const first = allPoints[0]
  const delta = selectedPoint ? selectedPoint[fieldKey] - first[fieldKey] : 0

  let coords = []
  let pathD = ''
  let areaD = ''
  let stats = null
  let lutealBands = []

  const showPhases = showCyclePhases && !!cycleSettings?.enabled && !cycleSettings?.sous_contraception
    && Array.isArray(cycleDays) && cycleDays.length > 0

  if (points.length >= 2) {
    const values = points.map(p => p[fieldKey])
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const yPad = span * 0.2

    const xFor = (i) => PAD_X + (i / (points.length - 1)) * (WIDTH - 2 * PAD_X)
    const yFor = (v) => PAD_TOP + (1 - (v - (min - yPad)) / (span + 2 * yPad)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

    coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p[fieldKey]) }))
    pathD = smoothPath(coords)
    const baseline = HEIGHT - PAD_BOTTOM
    areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`

    const avg = values.reduce((s, v) => s + v, 0) / values.length
    stats = { min, max, avg }

    // Bandes de phase lutéale en arrière-plan (rétention d'eau ≠ prise de gras).
    // L'axe x est indexé sur les points, pas sur le temps : on étend chaque
    // suite de points lutéaux jusqu'aux milieux vers les points voisins.
    if (showPhases) {
      const isLuteal = points.map(p => phaseForDate(p.date, cycleDays, cycleSettings) === 'luteale')
      let i = 0
      while (i < points.length) {
        if (!isLuteal[i]) { i++; continue }
        let j = i
        while (j + 1 < points.length && isLuteal[j + 1]) j++
        const left = i === 0 ? xFor(0) : (xFor(i - 1) + xFor(i)) / 2
        const right = j === points.length - 1 ? xFor(j) : (xFor(j) + xFor(j + 1)) / 2
        lutealBands.push({ x: left, w: Math.max(right - left, 2) })
        i = j + 1
      }
    }
  }

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 16 }}>
      {/* Valeur épinglée + écart depuis le tout premier relevé */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>
            {selectedPoint ? selectedPoint[fieldKey] : '—'} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>{unit}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
            {selectedPoint ? formatDateLong(selectedPoint.date) : 'Aucune donnée sur cette période'}
          </div>
        </div>
        {allPoints.length >= 2 && selectedPoint && (
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {delta === 0 ? '● stable' : delta > 0 ? `▲ +${Math.abs(delta).toFixed(1)}` : `▼ −${Math.abs(delta).toFixed(1)}`} {delta !== 0 && unit}
            <div style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 400, marginTop: 1 }}>depuis le {formatDateShort(first.date)}</div>
          </div>
        )}
      </div>

      {/* Courbe */}
      {points.length >= 2 ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '6px 0' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {lutealBands.map((b, i) => (
            <rect key={`lb${i}`} x={b.x.toFixed(1)} y={PAD_TOP - 6} width={b.w.toFixed(1)} height={HEIGHT - PAD_BOTTOM - (PAD_TOP - 6)} fill="var(--purple)" opacity="0.10" />
          ))}
          <path d={areaD} fill={`url(#${gradId})`} stroke="none" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={p.id} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
              <circle cx={coords[i].x} cy={coords[i].y} r={11} fill="transparent" />
              {i === selectedIndex && (
                <line x1={coords[i].x} y1={PAD_TOP - 6} x2={coords[i].x} y2={HEIGHT - PAD_BOTTOM} stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
              )}
              <circle
                cx={coords[i].x}
                cy={coords[i].y}
                r={i === selectedIndex ? 4.5 : 2}
                fill={i === selectedIndex ? color : 'var(--white)'}
                stroke={color}
                strokeWidth="1.5"
              />
            </g>
          ))}
          <text x={PAD_X} y={HEIGHT - 8} fontSize="10" fill="var(--text-hint)">{formatDateShort(points[0].date)}</text>
          <text x={WIDTH - PAD_X} y={HEIGHT - 8} fontSize="10" fill="var(--text-hint)" textAnchor="end">{formatDateShort(points[points.length - 1].date)}</text>
        </svg>
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-hint)' }}>
          {allPoints.length < 2 ? "Encore un relevé et la courbe apparaîtra ici." : 'Élargis la période pour voir la courbe.'}
        </div>
      )}

      {/* Sélecteur de période */}
      <div style={{ display: 'flex', gap: 6, marginBottom: stats ? 12 : 0 }}>
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className="chip"
            style={{
              flex: 1, textAlign: 'center', padding: '5px 4px',
              background: range === r.key ? 'var(--green)' : 'var(--green-light)',
              color: range === r.key ? 'white' : 'var(--green-dark)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {showPhases && lutealBands.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-hint)', marginBottom: stats ? 12 : 0, lineHeight: 1.4 }}>
          <span style={{ width: 18, height: 10, borderRadius: 2, background: 'var(--purple)', opacity: 0.18, flexShrink: 0 }} />
          Phase lutéale — le poids peut monter de 0,5 à 2 kg d'eau, ce n'est pas de la graisse.
        </div>
      )}

      {/* Min / Moy / Max sur la période affichée */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          {[
            { label: 'Min', val: stats.min },
            { label: 'Moy.', val: Math.round(stats.avg * 10) / 10 },
            { label: 'Max', val: stats.max },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{s.val} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-hint)' }}>{unit}</span></div>
              <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
