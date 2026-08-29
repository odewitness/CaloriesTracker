import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// CycleNutrientTips (Palier 4) — liste « bon moment pour… » repliée dans la
// pastille de phase (CyclePhaseBadge). Selon la phase : 1–2 nutriments à
// privilégier, avec les aliments des FAVORIS de l'utilisatrice qui en
// contiennent le plus. `rows` est calculé par cycleNutrientRows() dans
// src/lib/cycle.js.
// ─────────────────────────────────────────────────────────────────────────────
const shortName = (nom) => (nom || '').split(',')[0].trim()

export default function CycleNutrientTips({ rows }) {
  if (!rows?.length) return null

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>
        Parmi tes favoris, bon moment pour…
      </div>
      {rows.map(r => (
        <div key={r.key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
          <div style={{ fontSize: 10.5, color: 'var(--text-hint)', margin: '1px 0 4px', lineHeight: 1.4 }}>{r.hint}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {r.foods.map(f => (
              <span
                key={f.id}
                className="chip"
                style={{ background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 10.5 }}
                title={f.name}
              >
                {shortName(f.name)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
