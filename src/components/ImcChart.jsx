import React, { useState, useEffect, useMemo, useId } from 'react'
import { fmt } from '../lib/dates'

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

// Classification IMC (OMS, adulte) — bornes fixes, indépendantes des relevés.
const ZONES = [
  { to: 18.5, label: 'Maigreur', color: 'var(--blue)', lightColor: 'var(--blue-light)' },
  { from: 18.5, to: 25, label: 'Normal', color: 'var(--green)', lightColor: 'var(--green-light)' },
  { from: 25, to: 30, label: 'Surpoids', color: 'var(--amber)', lightColor: 'var(--amber-light)' },
  { from: 30, label: 'Obésité', color: 'var(--coral)', lightColor: 'var(--coral-light)' },
]

function zoneFor(imc) {
  return ZONES.find(z => (z.from == null || imc >= z.from) && (z.to == null || imc < z.to)) || ZONES[ZONES.length - 1]
}

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDateLong(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function cutoffDate(months) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return fmt(d)
}

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

// Graphique IMC — même logique de sélection de période/point que MetricChart,
// mais l'échelle verticale intègre toujours les 3 seuils OMS (18.5/25/30) et
// affiche les 4 zones de classification en fond, pour situer la courbe de
// l'utilisatrice par rapport à la référence générale (pas seulement par
// rapport à ses propres min/max).
export default function ImcChart({ entries, heightCm }) {
  const gradId = useId()
  const [range, setRange] = useState('tout')

  const allPoints = useMemo(() => {
    if (!heightCm) return []
    const heightM = heightCm / 100
    return entries
      .filter(e => e.poids_kg != null)
      .map(e => ({ id: e.id, date: e.date, imc: Math.round((e.poids_kg / (heightM * heightM)) * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [entries, heightCm])

  const rangeMonths = RANGES.find(r => r.key === range)?.months
  const points = useMemo(() => {
    if (!rangeMonths) return allPoints
    const cutoff = cutoffDate(rangeMonths)
    return allPoints.filter(p => p.date >= cutoff)
  }, [allPoints, rangeMonths])

  const [selected, setSelected] = useState(points.length - 1)
  useEffect(() => { setSelected(points.length - 1) }, [points.length, range])

  if (!heightCm || allPoints.length === 0) return null

  const selectedIndex = Math.min(Math.max(selected, 0), points.length - 1)
  const selectedPoint = points[selectedIndex]
  const first = allPoints[0]
  const delta = selectedPoint ? selectedPoint.imc - first.imc : 0

  let coords = []
  let pathD = ''
  let zoneRects = []
  let min, max

  if (points.length >= 2) {
    const values = points.map(p => p.imc)
    // Domaine toujours élargi aux 3 seuils OMS, pour garder la classification
    // générale visible même quand toutes les valeurs sont dans une seule zone.
    min = Math.min(...values, 18.5) - 1
    max = Math.max(...values, 30) + 1
    const span = max - min

    const xFor = (i) => PAD_X + (i / (points.length - 1)) * (WIDTH - 2 * PAD_X)
    const yFor = (v) => PAD_TOP + (1 - (v - min) / span) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

    coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.imc) }))
    pathD = smoothPath(coords)

    const top = PAD_TOP
    const bottom = HEIGHT - PAD_BOTTOM
    zoneRects = ZONES.map(z => {
      const zFrom = Math.max(z.from ?? min, min)
      const zTo = Math.min(z.to ?? max, max)
      if (zTo <= zFrom) return null
      return { ...z, y: yFor(zTo), height: yFor(zFrom) - yFor(zTo) }
    }).filter(Boolean).map(z => ({ ...z, y: Math.max(z.y, top), height: Math.min(z.y + z.height, bottom) - Math.max(z.y, top) }))
  }

  const currentZone = selectedPoint ? zoneFor(selectedPoint.imc) : null

  return (
    <div className="card" style={{ padding: '16px 16px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: currentZone?.color || 'var(--text)', lineHeight: 1.1 }}>
              {selectedPoint ? selectedPoint.imc : '—'}
            </div>
            {currentZone && (
              <span style={{ fontSize: 11, fontWeight: 700, color: currentZone.color, background: currentZone.lightColor, borderRadius: 6, padding: '2px 8px' }}>
                {currentZone.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
            {selectedPoint ? formatDateLong(selectedPoint.date) : 'Aucune donnée sur cette période'}
          </div>
        </div>
        {allPoints.length >= 2 && selectedPoint && (
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {delta === 0 ? '● stable' : delta > 0 ? `▲ +${Math.abs(delta).toFixed(1)}` : `▼ −${Math.abs(delta).toFixed(1)}`}
            <div style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 400, marginTop: 1 }}>depuis le {formatDateShort(first.date)}</div>
          </div>
        )}
      </div>

      {points.length >= 2 ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '6px 0' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--text)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {zoneRects.map((z, i) => (
            <rect key={i} x={PAD_X} y={z.y.toFixed(1)} width={WIDTH - 2 * PAD_X} height={Math.max(z.height, 0).toFixed(1)} fill={z.color} opacity="0.12" />
          ))}
          <path d={pathD} fill="none" stroke="var(--text)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => {
            const zone = zoneFor(p.imc)
            return (
              <g key={p.id} onClick={() => setSelected(i)} style={{ cursor: 'pointer' }}>
                <circle cx={coords[i].x} cy={coords[i].y} r={11} fill="transparent" />
                {i === selectedIndex && (
                  <line x1={coords[i].x} y1={PAD_TOP - 6} x2={coords[i].x} y2={HEIGHT - PAD_BOTTOM} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 3" opacity="0.35" />
                )}
                <circle
                  cx={coords[i].x}
                  cy={coords[i].y}
                  r={i === selectedIndex ? 4.5 : 2}
                  fill={i === selectedIndex ? zone.color : 'var(--white)'}
                  stroke={zone.color}
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
          <text x={PAD_X} y={HEIGHT - 8} fontSize="10" fill="var(--text-hint)">{formatDateShort(points[0].date)}</text>
          <text x={WIDTH - PAD_X} y={HEIGHT - 8} fontSize="10" fill="var(--text-hint)" textAnchor="end">{formatDateShort(points[points.length - 1].date)}</text>
        </svg>
      ) : (
        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-hint)' }}>
          {allPoints.length < 2 ? "Encore un relevé de poids et la courbe apparaîtra ici." : 'Élargis la période pour voir la courbe.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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

      {/* Légende de la classification OMS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
        {ZONES.map(z => (
          <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: z.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              {z.label} {z.from != null && z.to != null ? `(${z.from}–${z.to})` : z.to != null ? `(< ${z.to})` : `(≥ ${z.from})`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
