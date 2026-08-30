import React, { useMemo, useState, useEffect, useId } from 'react'
import { Scale, Flame } from 'lucide-react'
import { dayStatus, STATUS_COLOR, smoothPath, eachDay } from '../../lib/history'
import { todayStr } from '../../lib/dates'
import { phaseForDate } from '../../lib/cycle'

const WIDTH = 328
const HEIGHT = 182
const PAD_L = 8
const PAD_R = 8
const PAD_TOP = 18
const PAD_BOTTOM = 22
const PLOT_W = WIDTH - PAD_L - PAD_R
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM
const BASELINE = HEIGHT - PAD_BOTTOM

const WEEKDAY_INITIAL = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Graphique de tendance des calories — un histogramme dans tous les cas :
//   - Semaine / Mois : une barre par jour calendaire.
//   - Année : une barre par mois (moyenne kcal/j du mois).
// Couleur selon l'objectif (dayStatus), barre creuse pour un jour/mois exclu,
// point gris à la base pour une période non tracée, ligne d'objectif pointillée.
// Taper une barre → sélection : la ligne de lecture au-dessus affiche la date,
// les calories (ou « non tracké ») et le poids relevé le plus proche.
// « Détail ↓ » saute à la carte correspondante plus bas.
// weightPoints : [{ key, value }] — key = dateStr (jour) ou 'YYYY-MM' (mois).
export default function CalorieTrendChart({
  tab, bounds, days, goalKcal, excludedDates,
  monthSummaries = [], avgKcal,
  weightPoints = [], showWeight, onToggleWeight, onJumpToDetail,
  cycleDays, cycleSettings,
  sportDates,
  expenditurePoints = [], showExpenditure, onToggleExpenditure, canExpenditure = false,
}) {
  const gradId = useId()
  const isYear = tab === 'annee'
  const today = todayStr()

  // ── Barres (jour ou mois) ────────────────────────────────────────────────
  const points = useMemo(() => {
    if (isYear) {
      const year = bounds.start.slice(0, 4)
      const curMonth = today.slice(0, 7)
      return Array.from({ length: 12 }, (_, m) => {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        const ms = monthSummaries.find(s => s.key === key)
        return {
          key,
          value: ms ? ms.avgKcal : 0,
          label: new Date(key + '-01T12:00:00').toLocaleDateString('fr-FR', { month: 'long' }),
          excluded: false,
          untracked: !ms && key <= curMonth,
          future: key > curMonth,
        }
      })
    }
    return eachDay(bounds.start, bounds.end).map(dStr => {
      const es = days[dStr] || []
      const kcal = es.reduce((s, e) => s + (e.energie_kcal || 0), 0)
      const d = new Date(dStr + 'T12:00:00')
      return {
        key: dStr,
        value: kcal,
        excluded: excludedDates.has(dStr),
        untracked: kcal === 0 && dStr <= today,
        future: dStr > today,
        dayNum: d.getDate(),
        weekdayIdx: (d.getDay() + 6) % 7,
      }
    })
  }, [isYear, bounds.start, bounds.end, days, excludedDates, monthSummaries, today])

  const withData = points.filter(p => p.value > 0)
  const showExp = showExpenditure && canExpenditure
  const maxVal = Math.max(
    goalKcal,
    ...points.map(p => p.value),
    ...(showExp ? expenditurePoints.map(p => p.value) : []),
    1,
  ) * 1.12
  const yFor = (v) => PAD_TOP + (1 - v / maxVal) * PLOT_H
  const goalY = yFor(goalKcal)
  const slotW = PLOT_W / points.length
  const xFor = (i) => PAD_L + (i + 0.5) * slotW

  // ── Sélection : dernière barre renseignée par défaut ─────────────────────
  const defaultKey = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i].value > 0) return points[i].key
    return points.length ? points[points.length - 1].key : null
  }, [points])
  const [selectedKey, setSelectedKey] = useState(defaultKey)
  useEffect(() => { setSelectedKey(defaultKey) }, [defaultKey])
  const selIndex = points.findIndex(p => p.key === selectedKey)
  const sel = selIndex >= 0 ? points[selIndex] : null

  // ── Poids : échelle Y secondaire + relevé le plus proche d'une clé ───────
  const sortedW = useMemo(
    () => [...weightPoints].sort((a, b) => a.key.localeCompare(b.key)),
    [weightPoints],
  )
  const weightByKey = useMemo(() => new Map(weightPoints.map(w => [w.key, w.value])), [weightPoints])
  const canWeight = weightPoints.length >= 2
  const shownWeights = points.map(p => weightByKey.get(p.key)).filter(v => v != null)
  const wMin = shownWeights.length ? Math.min(...shownWeights) : 0
  const wMax = shownWeights.length ? Math.max(...shownWeights) : 1
  const wSpan = (wMax - wMin) || 1
  const wYFor = (v) => PAD_TOP + (1 - (v - (wMin - wSpan * 0.2)) / (wSpan * 1.4)) * PLOT_H

  const norm = (k) => (k && k.length === 7 ? `${k}-15` : k)
  const weightNear = (key) => {
    if (!sortedW.length || !key) return null
    const target = new Date(norm(key) + 'T12:00:00').getTime()
    let best = null, bestD = Infinity
    for (const w of sortedW) {
      const dist = Math.abs(new Date(norm(w.key) + 'T12:00:00').getTime() - target)
      if (dist < bestD) { bestD = dist; best = w }
    }
    const maxDist = (isYear ? 31 : 21) * 86400000
    return best && bestD <= maxDist ? best : null
  }

  // ── Superposition poids ─────────────────────────────────────────────────
  const weightCoords = useMemo(() => {
    if (!(showWeight && canWeight)) return []
    return points
      .map((p, i) => {
        const v = weightByKey.get(p.key)
        return v == null ? null : { x: xFor(i), y: wYFor(v), v }
      })
      .filter(Boolean)
  }, [showWeight, canWeight, points, weightByKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const weightPath = smoothPath(weightCoords)

  // ── Superposition dépense estimée (même axe kcal que les barres) ─────────
  const expByKey = useMemo(
    () => new Map(expenditurePoints.map(p => [p.key, p.value])),
    [expenditurePoints],
  )
  const expCoords = useMemo(() => {
    if (!showExp) return []
    return points
      .map((p, i) => {
        const v = expByKey.get(p.key)
        return v == null ? null : { x: xFor(i), y: yFor(v) }
      })
      .filter(Boolean)
  }, [showExp, points, expByKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const expPath = smoothPath(expCoords)

  const untrackedCount = points.filter(p => p.untracked && !p.excluded).length
  const hasChart = withData.length >= 1

  // Jours avec au moins une séance de sport → petit tiret vert sous la barre
  // (vues Semaine / Mois uniquement — au mois près, ça n'a pas de sens en Année).
  const sportBarIdx = useMemo(() => {
    if (isYear || !sportDates || sportDates.size === 0) return []
    return points.map((p, i) => (sportDates.has(p.key) ? i : -1)).filter(i => i >= 0)
  }, [isYear, sportDates, points])

  // Bandes de phase lutéale en arrière-plan, uniquement quand la courbe de
  // poids est superposée (contexte : rétention d'eau ≠ prise de gras) et hors
  // vue Année (barres mensuelles, la phase n'y a pas de sens).
  const showLutealBands = ((showWeight && canWeight) || showExp) && !isYear
    && !!cycleSettings?.enabled && !cycleSettings?.sous_contraception
    && Array.isArray(cycleDays) && cycleDays.length > 0
  const lutealBands = useMemo(() => {
    if (!showLutealBands) return []
    return points
      .map((p, i) => (phaseForDate(p.key, cycleDays, cycleSettings) === 'luteale' ? i : -1))
      .filter(i => i >= 0)
  }, [showLutealBands, points, cycleDays, cycleSettings])

  // ── Ligne de lecture du point sélectionné ───────────────────────────────
  const selLabel = !sel ? '—'
    : isYear ? cap(sel.label)
    : cap(new Date(sel.key + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }))
  const selKcalTxt = !sel ? '—'
    : sel.value > 0 ? `${Math.round(sel.value)} kcal${isYear ? '/j' : ''}`
    : sel.future ? 'à venir' : 'non tracké'
  const selKcalColor = sel && sel.value > 0 ? STATUS_COLOR[dayStatus(sel.value, goalKcal)] : 'var(--text-hint)'
  const selWeight = sel ? weightNear(sel.key) : null
  const selExp = showExp && sel ? expByKey.get(sel.key) : null
  const selBalance = (selExp != null && sel && sel.value > 0) ? Math.round(sel.value - selExp) : null

  return (
    <div className="card" style={{ padding: '16px 14px 12px', marginBottom: 12 }}>
      {/* Moyenne de la période + bascule superposition du poids */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
          {Math.round(avgKcal || 0)} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>kcal/j en moyenne</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {onToggleExpenditure && (
            <button
              onClick={canExpenditure ? onToggleExpenditure : undefined}
              className="chip"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11,
                background: showExpenditure && canExpenditure ? 'var(--amber)' : 'var(--green-light)',
                color: showExpenditure && canExpenditure ? 'white' : 'var(--green-dark)',
                opacity: canExpenditure ? 1 : 0.4, cursor: canExpenditure ? 'pointer' : 'default',
              }}
              title={canExpenditure ? 'Superposer ta dépense estimée' : 'Complète ton profil (sexe, âge, taille) pour estimer ta dépense'}
            >
              <Flame size={12} /> Dépense
            </button>
          )}
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
      </div>

      {/* Lecture du point sélectionné */}
      {hasChart && sel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>{selLabel}</span>
          <span style={{ color: selKcalColor, fontWeight: 600 }}>{selKcalTxt}</span>
          {selWeight && (
            <span style={{ color: 'var(--purple)', fontWeight: 600 }}>
              {selWeight.value} kg
              {selWeight.key !== sel.key && (
                <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>
                  {' '}(relevé {isYear
                    ? new Date(selWeight.key + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'short' })
                    : new Date(selWeight.key + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})
                </span>
              )}
            </span>
          )}
          {selExp != null && (
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>≈ {Math.round(selExp)} dépensées</span>
          )}
          {selBalance != null && (
            <span style={{ fontWeight: 700, color: selBalance >= 0 ? 'var(--coral)' : 'var(--green)' }}>
              {selBalance >= 0 ? '+' : '−'}{Math.abs(selBalance)} kcal{isYear ? '/j' : ''}
            </span>
          )}
          {onJumpToDetail && (
            <button
              onClick={() => onJumpToDetail(sel.key)}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--green)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Détail ↓
            </button>
          )}
        </div>
      )}

      {hasChart ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '4px 0' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Bandes phase lutéale (fond) */}
          {lutealBands.map(i => (
            <rect key={`lb${i}`} x={(xFor(i) - slotW / 2).toFixed(1)} y={PAD_TOP} width={slotW.toFixed(1)} height={PLOT_H} fill="var(--purple)" opacity="0.09" />
          ))}

          {/* Ligne d'objectif */}
          <line x1={PAD_L} y1={goalY} x2={WIDTH - PAD_R} y2={goalY} stroke="var(--text-hint)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Repère vertical du point sélectionné */}
          {sel && selIndex >= 0 && (
            <line x1={xFor(selIndex)} y1={PAD_TOP - 4} x2={xFor(selIndex)} y2={BASELINE} stroke="var(--text)" strokeWidth="1" strokeDasharray="2 3" opacity="0.35" />
          )}

          {points.map((p, i) => {
            const barW = Math.max(3, slotW * 0.6)
            const cx = xFor(i)
            const top = p.value > 0 ? yFor(p.value) : BASELINE
            const h = Math.max(0, BASELINE - top)
            const color = STATUS_COLOR[dayStatus(p.value, goalKcal)]
            const isSel = p.key === selectedKey
            const showLabel = isYear || tab === 'semaine' || p.dayNum === 1 || p.dayNum % 5 === 0
            const labelText = isYear ? p.label.slice(0, 3) : (tab === 'semaine' ? WEEKDAY_INITIAL[p.weekdayIdx] : p.dayNum)
            return (
              <g key={p.key} onClick={() => setSelectedKey(p.key)} style={{ cursor: 'pointer' }}>
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
                {p.untracked && !p.excluded && (
                  <circle cx={cx} cy={BASELINE - 2} r={1.7} fill="var(--text-hint)" opacity={isSel ? 0.9 : 0.5} />
                )}
                {isSel && p.value > 0 && (
                  <rect x={cx - barW / 2 - 1.5} y={top - 1.5} width={barW + 3} height={h + 1.5} rx={3} fill="none" stroke="var(--text)" strokeWidth="1" opacity="0.4" />
                )}
                {showLabel && (
                  <text x={cx} y={HEIGHT - 7} fontSize="9" fill="var(--text-hint)" textAnchor="middle">{labelText}</text>
                )}
              </g>
            )
          })}

          {/* Jours de sport : tiret vert sous la barre */}
          {sportBarIdx.map(i => (
            <line
              key={`sp${i}`}
              x1={xFor(i)} y1={BASELINE + 3} x2={xFor(i)} y2={BASELINE + 7}
              stroke="var(--green)" strokeWidth="2" strokeLinecap="round"
            />
          ))}

          {/* Superposition dépense estimée (ligne ambre, axe kcal) */}
          {showExp && expCoords.length >= 2 && (
            <>
              <path d={expPath} fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {points.length <= 12 && expCoords.map((c, i) => (
                <circle key={`ex${i}`} cx={c.x} cy={c.y} r={1.7} fill="var(--amber)" />
              ))}
            </>
          )}

          {/* Superposition poids */}
          {showWeight && canWeight && weightCoords.length >= 2 && (
            <>
              <path d={weightPath} fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {weightCoords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r={2} fill="var(--purple)" />
              ))}
            </>
          )}
        </svg>
      ) : (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-hint)' }}>
          {isYear ? 'Aucun mois loggé sur cette année.' : 'Logge une journée pour voir apparaître le graphique.'}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-hint)', marginTop: 2, gap: 8 }}>
        <span>
          Ligne pointillée = objectif {goalKcal} kcal
          {untrackedCount > 0 ? ` · point gris = ${isYear ? 'mois' : 'jour'} non tracké` : ''}
        </span>
        {showWeight && canWeight && shownWeights.length >= 2 && (
          <span style={{ color: 'var(--purple)', fontWeight: 600, whiteSpace: 'nowrap' }}>Poids {wMin}–{wMax} kg</span>
        )}
      </div>
      {hasChart && untrackedCount > 0 && (
        <div style={{ fontSize: 10, marginTop: 4, color: showWeight ? 'var(--coral)' : 'var(--text-hint)' }}>
          {isYear
            ? `${untrackedCount} mois sans aucun suivi`
            : `${untrackedCount} jour${untrackedCount > 1 ? 's' : ''} non tracké${untrackedCount > 1 ? 's' : ''} sur la période`}
          {showWeight ? ' — tes calories réelles étaient sûrement plus élevées.' : '.'}
        </div>
      )}
      {showExp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 4, color: 'var(--text-hint)', lineHeight: 1.4 }}>
          <span style={{ width: 16, height: 2, borderRadius: 1, background: 'var(--amber)', flexShrink: 0 }} />
          Ligne ambre = dépense estimée (métabolisme de base + tes pas et séances{isYear ? ', moyenne par jour du mois' : ' du jour'}). Approximatif, ±20 % — à ne pas cumuler avec ton objectif.
        </div>
      )}
      {showLutealBands && lutealBands.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 4, color: 'var(--text-hint)' }}>
          <span style={{ width: 16, height: 9, borderRadius: 2, background: 'var(--purple)', opacity: 0.16, flexShrink: 0 }} />
          {showWeight
            ? "Bandes = phase lutéale : le poids peut monter de 0,5 à 2 kg d'eau."
            : 'Bandes = phase lutéale.'}
        </div>
      )}
      {sportBarIdx.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 4, color: 'var(--text-hint)' }}>
          <span style={{ width: 2, height: 10, borderRadius: 1, background: 'var(--green)', flexShrink: 0 }} />
          Tiret vert = jour avec au moins une séance de sport.
        </div>
      )}
    </div>
  )
}
