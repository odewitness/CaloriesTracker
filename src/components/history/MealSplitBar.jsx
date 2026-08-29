import React, { useMemo } from 'react'

const MEALS = [
  { key: 'Petit-déjeuner', color: 'var(--green)' },
  { key: 'Déjeuner',       color: 'var(--amber)' },
  { key: 'Dîner',          color: 'var(--coral)' },
  { key: 'Collation',      color: 'var(--blue)' },
  { key: 'Autre',          color: 'var(--text-hint)' },
]

// Répartition moyenne des calories par repas sur la période (kcal/jour loggé).
export default function MealSplitBar({ entries, daysCounted, excludedDates }) {
  const { rows, total } = useMemo(() => {
    const n = daysCounted || 1
    const byMeal = {}
    for (const e of entries) {
      if (excludedDates.has(e.date)) continue
      const bucket = MEALS.some(m => m.key === e.meal) ? e.meal : 'Autre'
      byMeal[bucket] = (byMeal[bucket] || 0) + (e.energie_kcal || 0)
    }
    const rows = MEALS
      .map(m => ({ ...m, kcal: (byMeal[m.key] || 0) / n }))
      .filter(m => m.kcal > 0)
    const total = rows.reduce((s, r) => s + r.kcal, 0)
    return { rows, total }
  }, [entries, daysCounted, excludedDates])

  if (!rows.length) return null

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        {rows.map(r => (
          <div key={r.key} style={{ width: `${(r.kcal / total) * 100}%`, background: r.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text)' }}>{r.key}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{Math.round(r.kcal)} kcal</span>
            <span style={{ color: 'var(--text-hint)', width: 34, textAlign: 'right' }}>{Math.round((r.kcal / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}
