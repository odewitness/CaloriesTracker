import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt } from '../lib/dates'

const STATUS_COLOR = {
  ok:   'var(--green)',
  off:  'var(--coral)',
  none: 'var(--border-md)',
}
const STATUS_BG = {
  ok:   'var(--green-light)',
  off:  'var(--coral-light)',
  none: 'transparent',
}

export const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Construit la grille du mois : jours du mois précédent/suivant en padding
// pour compléter les semaines (lundi = premier jour, convention FR).
export function buildMonthCells(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // 0=dimanche...6=samedi → converti en 0=lundi...6=dimanche
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(year, month, 1 - (firstWeekday - i))
    cells.push({ date: d, inMonth: false })
  }
  for (let day = 1; day <= lastOfMonth.getDate(); day++) {
    cells.push({ date: new Date(year, month, day), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }
  return cells
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarMonthGrid
// Props :
//   monthDate       — n'importe quelle date du mois affiché
//   onChangeMonth(dir) — dir = -1 | 1
//   selectedDate     — Date actuellement sélectionnée (mode single, ignoré si selectedDates fourni)
//   onSelectDate(date)
//   dayStatusByDate  — { 'YYYY-MM-DD': 'ok'|'off'|'none' }
//   hasPlannedByDate — { 'YYYY-MM-DD': true|'planned'|'missed' } — jours avec repas planifié
//                       non mangé ('missed' = date passée, dot corail au lieu de violet)
//
// Mode multi-sélection (utilisé par le picker de jours de PlanMealModal) :
//   selectedDates    — Set<'YYYY-MM-DD'> — si fourni, active le mode multi
//   onToggleDate(date) — appelé au clic à la place de onSelectDate
//   minDate          — 'YYYY-MM-DD' — jours antérieurs désactivés/grisés
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarMonthGrid({
  monthDate, onChangeMonth, selectedDate, onSelectDate,
  dayStatusByDate = {}, hasPlannedByDate = {}, excludedDates,
  selectedDates, onToggleDate, minDate,
}) {
  const cells = useMemo(() => buildMonthCells(monthDate), [monthDate.getFullYear(), monthDate.getMonth()])
  const todayStr = fmt(new Date())
  const isMulti = !!selectedDates
  const selectedStr = isMulti ? null : fmt(selectedDate)

  return (
    <div className="card" style={{ padding: '14px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button className="btn-icon" onClick={() => onChangeMonth(-1)}>
          <ChevronLeft size={18} color="var(--text-muted)" />
        </button>
        <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>
          {monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
        <button className="btn-icon" onClick={() => onChangeMonth(1)}>
          <ChevronRight size={18} color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', padding: '4px 0' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map(({ date, inMonth }, i) => {
          const dStr = fmt(date)
          const status = dayStatusByDate[dStr] || 'none'
          const isToday = dStr === todayStr
          const isSelected = isMulti ? selectedDates.has(dStr) : dStr === selectedStr
          const plannedStatus = hasPlannedByDate[dStr]
          const hasPlanned = !!plannedStatus
          const isMissed = plannedStatus === 'missed'
          const disabled = minDate ? dStr < minDate : false
          const isExcluded = !!excludedDates?.has(dStr)

          return (
            <button
              key={i}
              onClick={disabled ? undefined : () => (isMulti ? onToggleDate(date) : onSelectDate(date))}
              disabled={disabled}
              style={{
                aspectRatio: '1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10,
                background: isSelected ? 'var(--green)' : STATUS_BG[status],
                opacity: disabled ? 0.3 : (inMonth ? 1 : 0.35),
                border: isToday && !isSelected ? '1.5px solid var(--green)' : '1.5px solid transparent',
                position: 'relative',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: isToday || isSelected ? 700 : 500,
                color: isSelected ? 'white' : isExcluded ? 'var(--text-hint)' : 'var(--text)',
                textDecoration: isExcluded ? 'line-through' : 'none',
              }}>
                {date.getDate()}
              </span>
              {status !== 'none' && !isSelected && !isExcluded && (
                <span style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: STATUS_COLOR[status], marginTop: 2,
                }} />
              )}
              {hasPlanned && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 5, height: 5, borderRadius: '50%',
                  background: isSelected ? 'white' : (isMissed ? 'var(--coral)' : 'var(--purple)'),
                }} />
              )}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <Legend color="var(--green)" label="Objectifs atteints" />
        <Legend color="var(--coral)" label="Trop / pas assez" />
        <Legend color="var(--purple)" label="Repas planifié" dot />
        <Legend color="var(--text-hint)" label="Jour exclu des stats" />
      </div>
    </div>
  )
}

function Legend({ color, label, dot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )
}
