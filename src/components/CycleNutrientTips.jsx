import React, { useMemo } from 'react'
import { microFocusForPhase, PHASES } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// CycleNutrientTips (Palier 4) — petite carte sur la page du jour : selon la
// phase (règles / lutéale), 1–2 nutriments à privilégier + quelques aliments
// qui en contiennent le plus, tirés de la base Ciqual déjà chargée. Purement
// informatif, orienté aliments — aucune dose de complément.
// ─────────────────────────────────────────────────────────────────────────────

const EXCLUDE_CATEGORIES = new Set([
  'Compléments', 'Aides culinaires', 'Herbes et épices', 'Épices',
  'Condiments', 'Sels', 'Eaux',
])

function topFoods(foods, key, n = 5) {
  return [...foods]
    .filter(f => (f[key] ?? 0) > 0 && !EXCLUDE_CATEGORIES.has(f.categorie))
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, n)
}

const shortName = (nom) => (nom || '').split(',')[0].trim()

export default function CycleNutrientTips({ phase, ciqualFoods, cycleSettings }) {
  const focus = microFocusForPhase(phase, cycleSettings)
  const color = PHASES[phase]?.color || 'var(--purple)'

  const rows = useMemo(() => {
    if (!focus.length || !ciqualFoods?.length) return []
    return focus.map(f => ({ ...f, foods: topFoods(ciqualFoods, f.key) }))
  }, [focus, ciqualFoods])

  if (!rows.length || rows.every(r => r.foods.length === 0)) return null

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>Bon moment pour…</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-hint)', margin: '2px 0 8px' }}>
        Des aliments à privilégier, pas des compléments — aucune dose sans bilan sanguin.
      </div>
      {rows.map(r => (
        <div key={r.key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginBottom: 4, lineHeight: 1.4 }}>{r.hint}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {r.foods.map(f => (
              <span
                key={f.alim_code}
                className="chip"
                style={{ background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 10.5 }}
                title={f.alim_nom}
              >
                {shortName(f.alim_nom)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
