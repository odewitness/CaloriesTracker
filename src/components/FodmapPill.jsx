import React from 'react'

// Couleurs et libellés des niveaux FODMAP (voir LEVEL_RANK dans
// src/lib/fodmap.js), partagés par la fiche aliment, le journal et la carte
// de la page du jour.
export const FODMAP_LEVEL_STYLE = {
  low: { label: 'Faible', dot: 'var(--green)', bg: 'var(--green-light)', color: 'var(--green-dark)' },
  'likely-low': { label: 'Probablement faible', dot: 'var(--green)', bg: 'var(--gray-bg)', color: 'var(--text-muted)' },
  unknown: { label: 'Inconnu', dot: 'var(--text-hint)', bg: 'var(--gray-bg)', color: 'var(--text-muted)' },
  'likely-high': { label: 'Probablement élevé', dot: 'var(--amber)', bg: 'var(--amber-light)', color: 'var(--amber)' },
  moderate: { label: 'Modéré', dot: 'var(--amber)', bg: 'var(--amber-light)', color: 'var(--amber)' },
  high: { label: 'Élevé', dot: 'var(--coral)', bg: 'var(--coral-light)', color: 'var(--coral)' },
}

// Niveaux qui méritent une pastille sur une ligne du journal (les autres
// restent discrets pour ne pas surcharger la liste).
export const FODMAP_NOTABLE = new Set(['likely-high', 'moderate', 'high'])

export default function FodmapPill({ level, text, small = false }) {
  const s = FODMAP_LEVEL_STYLE[level] || FODMAP_LEVEL_STYLE.unknown
  return (
    <span style={{
      fontSize: small ? 10 : 11, fontWeight: 600,
      padding: small ? '1px 6px' : '3px 8px', borderRadius: 999,
      background: s.bg, color: s.color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {text || s.label}
    </span>
  )
}
