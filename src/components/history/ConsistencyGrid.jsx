import React, { useMemo } from 'react'
import { buildMonthCells, WEEKDAYS } from '../CalendarMonthGrid'
import { STATUS_COLOR, STATUS_BG } from '../../lib/history'
import { fmt, todayStr } from '../../lib/dates'

// Calendrier de régularité en lecture seule : chaque jour teinté selon son
// statut (non loggé / bien ou un peu en dessous / dans l'objectif / un peu ou
// bien au-dessus / exclu). `layout='month'` → grille calendaire, cases tapables.
// `layout='year'` → 12 lignes (une par mois) × jusqu'à 31 cases, non tapable.
export default function ConsistencyGrid({ layout, statusByDate, excludedDates, monthDate, year, onSelectDate }) {
  if (layout === 'year') return <YearStrip year={year} statusByDate={statusByDate} excludedDates={excludedDates} />
  return <MonthCalendar monthDate={monthDate} statusByDate={statusByDate} excludedDates={excludedDates} onSelectDate={onSelectDate} />
}

function MonthCalendar({ monthDate, statusByDate, excludedDates, onSelectDate }) {
  const cells = useMemo(
    () => buildMonthCells(monthDate),
    [monthDate.getFullYear(), monthDate.getMonth()], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const today = todayStr()

  return (
    <div className="card" style={{ padding: '14px 12px', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', padding: '4px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map(({ date, inMonth }, i) => {
          const dStr = fmt(date)
          const status = statusByDate[dStr] || 'none'
          const excluded = !!excludedDates?.has(dStr)
          const isToday = dStr === today
          const logged = status !== 'none'
          return (
            <button
              key={i}
              onClick={inMonth && logged ? () => onSelectDate?.(dStr) : undefined}
              style={{
                aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 10,
                background: STATUS_BG[status],
                opacity: inMonth ? (excluded ? 0.5 : 1) : 0.3,
                border: isToday ? '1.5px solid var(--green)' : '1.5px solid transparent',
                cursor: inMonth && logged ? 'pointer' : 'default',
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: isToday ? 700 : 500,
                color: excluded ? 'var(--text-hint)' : 'var(--text)',
                textDecoration: excluded ? 'line-through' : 'none',
              }}>
                {date.getDate()}
              </span>
              {logged && !excluded && (
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: STATUS_COLOR[status], marginTop: 2 }} />
              )}
            </button>
          )
        })}
      </div>
      <Legend />
    </div>
  )
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function YearStrip({ year, statusByDate, excludedDates }) {
  return (
    <div className="card" style={{ padding: '14px 12px', marginBottom: 12, overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 300 }}>
        {MONTH_LABELS.map((label, m) => {
          const daysInMonth = new Date(year, m + 1, 0).getDate()
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 26, flexShrink: 0, fontSize: 9, color: 'var(--text-hint)', fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', gap: 1.5, flex: 1 }}>
                {Array.from({ length: 31 }, (_, d) => {
                  if (d >= daysInMonth) return <span key={d} style={{ flex: 1, minWidth: 0 }} />
                  const dStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
                  const status = statusByDate[dStr] || 'none'
                  const excluded = !!excludedDates?.has(dStr)
                  return (
                    <span
                      key={d}
                      title={dStr}
                      style={{
                        flex: 1, minWidth: 0, aspectRatio: '1', borderRadius: 2,
                        background: status === 'none' ? 'var(--gray-bg)' : STATUS_COLOR[status],
                        opacity: excluded ? 0.4 : 1,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <Legend />
    </div>
  )
}

function Legend() {
  const items = [
    { color: 'var(--blue-dark)', label: 'Bien en dessous' },
    { color: 'var(--blue)', label: 'Un peu en dessous' },
    { color: 'var(--green)', label: 'Dans l’objectif' },
    { color: 'var(--amber)', label: 'Un peu au-dessus' },
    { color: 'var(--coral)', label: 'Bien au-dessus' },
    { color: 'var(--text-hint)', label: 'Exclu' },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.color }} />
          <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{it.label}</span>
        </div>
      ))}
    </div>
  )
}
