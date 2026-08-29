import React, { useMemo } from 'react'

const LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// Moyenne des calories par jour de la semaine sur la période affichée — fait
// ressortir une dérive du week-end. Ne compte que les jours loggés et non exclus.
export default function WeekdayProfile({ days, excludedDates, goalKcal }) {
  const avgByWeekday = useMemo(() => {
    const sum = Array(7).fill(0)
    const count = Array(7).fill(0)
    for (const [dStr, es] of Object.entries(days)) {
      if (excludedDates.has(dStr)) continue
      const kcal = es.reduce((s, e) => s + (e.energie_kcal || 0), 0)
      if (!kcal) continue
      const idx = (new Date(dStr + 'T12:00:00').getDay() + 6) % 7
      sum[idx] += kcal
      count[idx] += 1
    }
    return sum.map((s, i) => (count[i] ? s / count[i] : 0))
  }, [days, excludedDates])

  const max = Math.max(goalKcal, ...avgByWeekday, 1)
  if (avgByWeekday.every(v => v === 0)) return null

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
        {avgByWeekday.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9, color: 'var(--text-hint)', fontWeight: 600 }}>{v ? Math.round(v) : '—'}</span>
            <div style={{ width: '100%', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${(v / max) * 100}%`,
                minHeight: v ? 3 : 0,
                background: v > goalKcal ? 'var(--coral)' : 'var(--green)',
                borderRadius: 3,
                transition: 'height .4s',
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 8 }}>
        Moyenne kcal par jour de semaine · barre rouge = au-dessus de l’objectif
      </div>
    </div>
  )
}
