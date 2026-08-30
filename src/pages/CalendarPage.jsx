import React, { useState, useMemo, useCallback } from 'react'
import { Calendar, CalendarDays, Plus, Pill, CalendarClock } from 'lucide-react'
import CalendarMonthGrid from '../components/CalendarMonthGrid'
import CalendarWeekStrip from '../components/CalendarWeekStrip'
import DayRecapPanel from '../components/DayRecapPanel'
import PlanMealModal from '../components/PlanMealModal'
import PlannedSeriesModal from '../components/PlannedSeriesModal'
import { useJournalRange } from '../hooks/useJournalRange'
import { usePlannedMealsRange } from '../hooks/usePlannedMeals'
import { useExcludedDaysRange } from '../hooks/useExcludedDays'
import { useSettings } from '../hooks/useSettings'
import { useCycle } from '../hooks/useCycle'
import { useSportRange } from '../hooks/useSport'
import { computeTotals, getDayStatus } from '../lib/nutrients'
import { phasesForRange } from '../lib/cycle'
import { fmt } from '../lib/dates'

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
  const [planModal, setPlanModal] = useState(null) // 'repas' | 'complement' | null
  const [showSeries, setShowSeries] = useState(false)
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
  const { excludedDates, refetch: refetchExcluded } = useExcludedDaysRange(rangeStart, rangeEnd)
  const { days: cycleDays } = useCycle()
  const { byDate: sportByDateRaw } = useSportRange(rangeStart, rangeEnd)

  const cycleByDate = useMemo(() => {
    const cfg = settings.cycle
    if (!cfg?.enabled || cfg.afficher_sur_calendrier === false || cycleDays.length === 0) return undefined
    return phasesForRange(fmt(rangeStart), fmt(rangeEnd), cycleDays, cfg)
  }, [settings.cycle, cycleDays, rangeStart, rangeEnd])

  const sportByDate = useMemo(() => {
    const cfg = settings.sport
    if (!cfg?.enabled || cfg.afficher_calendrier === false) return undefined
    return sportByDateRaw
  }, [settings.sport, sportByDateRaw])

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
    const todayStr = fmt(new Date())
    const result = {}
    for (const dateStr of Object.keys(planifiesByDate)) {
      if (planifiesByDate[dateStr].some(r => !r.mange)) {
        result[dateStr] = dateStr < todayStr ? 'missed' : 'planned'
      }
    }
    return result
  }, [planifiesByDate])

  const refetchAll = useCallback(() => { refetchJournal(); refetchPlanifies(); refetchExcluded() }, [refetchJournal, refetchPlanifies, refetchExcluded])

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setPlanModal('repas')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--green-light)', color: 'var(--green-dark)',
            border: 'none', borderRadius: 10, padding: '10px 12px',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
          }}
        >
          <Plus size={14} /> Planifier un repas
        </button>
        <button
          onClick={() => setPlanModal('complement')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--purple-light, #ede9fe)', color: 'var(--purple, #8b5cf6)',
            border: 'none', borderRadius: 10, padding: '10px 12px',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
          }}
        >
          <Pill size={14} /> Planifier des compléments
        </button>
        <button
          onClick={() => setShowSeries(true)}
          aria-label="Mes programmations"
          title="Mes programmations"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--gray-bg)', color: 'var(--text-muted)',
            border: 'none', borderRadius: 10, padding: '0 12px', flexShrink: 0,
          }}
        >
          <CalendarClock size={16} />
        </button>
      </div>

      {view === 'month' ? (
        <CalendarMonthGrid
          monthDate={anchorDate}
          onChangeMonth={changeMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dayStatusByDate={dayStatusByDate}
          hasPlannedByDate={hasPlannedByDate}
          excludedDates={excludedDates}
          cycleByDate={cycleByDate}
          sportByDate={sportByDate}
        />
      ) : (
        <CalendarWeekStrip
          weekDate={anchorDate}
          onChangeWeek={changeWeek}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          dayStatusByDate={dayStatusByDate}
          hasPlannedByDate={hasPlannedByDate}
          excludedDates={excludedDates}
        />
      )}

      <DayRecapPanel date={selectedDate} onPlannedChange={refetchAll} onExcludedChange={refetchExcluded} />

      {planModal && (
        <PlanMealModal
          kind={planModal}
          defaultDate={selectedDate}
          onClose={() => setPlanModal(null)}
          onPlanned={refetchAll}
        />
      )}

      {showSeries && (
        <PlannedSeriesModal
          onClose={() => setShowSeries(false)}
          onChange={refetchAll}
        />
      )}
    </div>
  )
}
