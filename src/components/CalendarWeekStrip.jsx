import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmt } from '../lib/dates'
import { PHASES } from '../lib/cycle'
import CalendarDayMarkers, { CalendarLegend } from './CalendarDayMarkers'

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

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Lundi de la semaine contenant `date`
function startOfWeek(date) {
  const d = new Date(date)
  const weekday = (d.getDay() + 6) % 7 // 0=lundi
  d.setDate(d.getDate() - weekday)
  return d
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarWeekStrip
// Props : mêmes conventions que CalendarMonthGrid (dont cycleByDate / sportByDate
// pour la parité des repères), mais `weekDate` = une date quelconque de la
// semaine affichée, onChangeWeek(dir) = -1 | 1.
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarWeekStrip({
  weekDate, onChangeWeek, selectedDate, onSelectDate,
  dayStatusByDate = {}, hasPlannedByDate = {}, excludedDates,
  cycleByDate, sportByDate, legend = false,
}) {
  const days = useMemo(() => {
    const start = startOfWeek(weekDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate()])

  const todayStr = fmt(new Date())
  const selectedStr = fmt(selectedDate)
  const start = days[0]
  const end = days[6]
  const sameMonth = start.getMonth() === end.getMonth()
  const [showLegend, setShowLegend] = useState(false)

  return (
    <div className="card" style={{ padding: '14px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button className="btn-icon" onClick={() => onChangeWeek(-1)}>
          <ChevronLeft size={18} color="var(--text-muted)" />
        </button>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {sameMonth
            ? `${start.getDate()} – ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'long' })}`
            : `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
        </div>
        <button className="btn-icon" onClick={() => onChangeWeek(1)}>
          <ChevronRight size={18} color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {days.map((date, i) => {
          const dStr = fmt(date)
          const status = dayStatusByDate[dStr] || 'none'
          const isToday = dStr === todayStr
          const isSelected = dStr === selectedStr
          const plannedStatus = hasPlannedByDate[dStr]
          const isExcluded = !!excludedDates?.has(dStr)
          const cyc = cycleByDate?.[dStr]
          const isPeriodDay = !!cyc?.isPeriod
          const phaseColor = cyc && cyc.phase !== 'inconnue' && !isPeriodDay ? PHASES[cyc.phase]?.color : null
          const hasSport = !!(sportByDate?.[dStr]?.length)

          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: '8px 2px 10px', borderRadius: 10,
                background: isSelected ? 'var(--green)' : STATUS_BG[status],
                border: isToday && !isSelected ? '1.5px solid var(--green)' : '1.5px solid transparent',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: isSelected ? 'rgba(255,255,255,.8)' : 'var(--text-hint)' }}>
                {WEEKDAY_SHORT[i]}
              </span>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: isSelected ? 'white' : isExcluded ? 'var(--text-hint)' : 'var(--text)',
                textDecoration: isExcluded ? 'line-through' : 'none',
              }}>
                {date.getDate()}
              </span>
              {status !== 'none' && !isSelected && !isExcluded && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: STATUS_COLOR[status] }} />
              )}
              <CalendarDayMarkers marks={{
                planned: plannedStatus, hasSport, phaseColor,
                isPeriod: isPeriodDay, isSelected, compact: false,
              }} />
            </button>
          )
        })}
      </div>

      {legend && (
        <CalendarLegend
          showCycle={!!cycleByDate}
          showSport={!!sportByDate}
          open={showLegend}
          onToggle={() => setShowLegend(o => !o)}
        />
      )}
    </div>
  )
}
