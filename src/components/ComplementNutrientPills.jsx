import React from 'react'
import { NUTRIENT_STATUS_COLOR } from '../lib/nutrientStatus'

// ─────────────────────────────────────────────────────────────────────────────
// ComplementNutrientPills — pastilles %AJR pour les vitamines/minéraux d'un
// complément alimentaire (voir getComplementNutrients). Ne rend pas de
// conteneur propre : renvoie directement la liste de pastilles pour que
// l'appelant les place dans sa propre rangée flex (ex: à côté de la marque).
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplementNutrientPills({ nutrients }) {
  return nutrients.map(({ field, pct, status }) => (
    <span
      key={field.key}
      title={field.label}
      style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '4px 9px', fontSize: 11.5, fontWeight: 700, color: NUTRIENT_STATUS_COLOR[status] }}
    >
      {status === 'excess' ? '⚠︎ ' : ''}{field.short} <span style={{ fontWeight: 500, color: 'var(--text-hint)' }}>{pct}%</span>
    </span>
  ))
}
