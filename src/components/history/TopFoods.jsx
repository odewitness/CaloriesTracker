import React, { useMemo } from 'react'

// Aliments les plus fréquents de la période : même clé d'identité que
// useJournalFoodHistory (`${food_source}:${food_ref_id ?? food_name}`), triés
// par nombre d'occurrences puis par calories cumulées. Non interactif.
export default function TopFoods({ entries, limit = 5 }) {
  const top = useMemo(() => {
    const byKey = new Map()
    for (const e of entries) {
      const key = `${e.food_source}:${e.food_ref_id ?? e.food_name}`
      const cur = byKey.get(key) || { name: e.food_name, count: 0, kcal: 0 }
      cur.count += 1
      cur.kcal += e.energie_kcal || 0
      byKey.set(key, cur)
    }
    return [...byKey.values()]
      .sort((a, b) => b.count - a.count || b.kcal - a.kcal)
      .slice(0, limit)
  }, [entries, limit])

  if (!top.length) return null
  const maxCount = top[0].count

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {top.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 8 }}>{f.name}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                ×{f.count} <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>· {Math.round(f.kcal)} kcal</span>
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(f.count / maxCount) * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
