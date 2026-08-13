import React, { useState, useMemo, useCallback } from 'react'
import { Calendar, CalendarDays } from 'lucide-react'
import CalendarMonthGrid from '../components/CalendarMonthGrid'
import CalendarWeekStrip from '../components/CalendarWeekStrip'
import DayRecapPanel from '../components/DayRecapPanel'
import { useJournalRange } from '../hooks/useJournalRange'
import { usePlannedMealsRange } from '../hooks/usePlannedMeals'
import { useSettings } from '../hooks/useSettings'
import { computeTotals, getDayStatus } from '../lib/nutrients'

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function startOfWeek(d) {
  const r = new Date(d)
  const weekday = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - weekday)
  return r
}
function endOfWeek(d) {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return e
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarPage — vue Mois/Semaine + récap du jour sélectionné en dessous.
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [view, setView] = useState('month') // 'month' | 'week'
  const [anchorDate, setAnchorDate] = useState(new Date()) // mois ou semaine affiché
  const [selectedDate, setSelectedDate] = useState(new Date())
  const { settings } = useSettings()

  // Plage chargée = mois affiché élargi de quelques jours de padding (les
  // cases hors-mois visibles dans la grille), suffisant aussi pour la vue
  // semaine qui est toujours incluse dans cette plage.
  const rangeStart = useMemo(() => {
    const s = view === 'month' ? startOfMonth(anchorDate) : startOfWeek(anchorDate)
    const padded = new Date(s); padded.setDate(padded.getDate() - 7)
    return padded
  }, [anchorDate, view])
  const rangeEnd = useMemo(() => {
    const e = view === 'month' ? endOfMonth(anchorDate) : endOfWeek(anchorDate)
    const padded = new Date(e); padded.setDate(padded.getDate() + 7)
    return padded
  }, [anchorDate, view])

  const { byDate: journalByDate, refetch: refetchJournal } = useJournalRange(rangeStart, rangeEnd)
  const { byDate: planifiesByDate, refetch: refetchPlanifies } = usePlannedMealsRange(rangeStart, rangeEnd)

  const dayStatusByDate = useMemo(() => {
    const result = {}
    for (const dateStr of Object.keys(journalByDate)) {
      const entries = journalByDate[dateStr]
      const totals = computeTotals(entries)
      result[dateStr] = getDayStatus(totals, settings, entries.length > 0)
    }
    return result
  }, [journalByDate, settings])

  const hasPlannedByDate = useMemo(() => {
    const result = {}
    for (const dateStr of Object.keys(planifiesByDate)) {
      if (planifiesByDate[dateStr].some(r => !r.mange)) result[dateStr] = true
    }
    return result
  }, [planifiesByDate])

  const refetchAll = useCallback(() => { refetchJournal(); refetchPlanifies() }, [refetchJournal, refetchPlanifies])

  const changeMonth = (dir) => {
    setAnchorDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))
  }
  const changeWeek = (dir) => {
    setAnchorDate(d => { const n = new Date(d); n.setDate(n.getDate() + dir * 7); return n })
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Calendrier</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Suivi et repas planifiés</div>
        </div>
        <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
          {[
            { key: 'month', label: 'Mois', icon: <Calendar size={14} /> },
            { key: 'week',  label: 'Semaine', icon: <CalendarDays size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
                background: view === t.key ? 'var(--white)' : 'transparent',
                color: view === t.key ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: view === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <CalendarMonthGrid
          monthDate={anchorDate}
          onChangeMonth={changeMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dayStatusByDate={dayStatusByDate}
          hasPlannedByDate={hasPlannedByDate}
        />
      ) : (
        <CalendarWeekStrip
          weekDate={anchorDate}
          onChangeWeek={changeWeek}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dayStatusByDate={dayStatusByDate}
          hasPlannedByDate={hasPlannedByDate}
        />
      )}

      <DayRecapPanel date={selectedDate} onPlannedChange={refetchAll} />
    </div>
  )
}
