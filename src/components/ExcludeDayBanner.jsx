import React from 'react'
import { EyeOff } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ExcludeDayBanner — bascule "exclure ce jour de mes stats" affichée en haut
// du récap d'un jour (DaySlot dans TodayPage.jsx, DayRecapPanel.jsx). Le jour
// reste consultable et modifiable normalement des deux côtés du toggle, voir
// useExcludedDay dans src/hooks/useExcludedDays.js — seuls les agrégats de
// HistoryPage.jsx ignorent les jours exclus.
// ─────────────────────────────────────────────────────────────────────────────
export default function ExcludeDayBanner({ excluded, onToggle }) {
  if (excluded) {
    return (
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          background: 'var(--gray-bg)', border: 'none', borderRadius: 10,
          padding: '10px 12px', marginBottom: 14, cursor: 'pointer', fontFamily: 'var(--font)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
          <EyeOff size={14} /> Jour exclu de tes stats
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>Réinclure</span>
      </button>
    )
  }
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', padding: '0 2px 12px',
        fontSize: 12, color: 'var(--text-hint)', cursor: 'pointer', fontFamily: 'var(--font)',
      }}
    >
      <EyeOff size={12} /> Exclure ce jour de mes stats
    </button>
  )
}
