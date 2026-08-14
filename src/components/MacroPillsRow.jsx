import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// MacroPillsRow — une rangée de pastilles (kcal, P, G, L) pour une échelle
// donnée (100g, portion, dose...). Réutilisé par les cartes recette et aliment.
// ─────────────────────────────────────────────────────────────────────────────
export default function MacroPillsRow({ label, labelColor, bg, kcal, kcalColor, proteines, glucides, lipides, hint, marginBottom }) {
  const pillStyle = { background: bg, borderRadius: 8, padding: '4px 9px', fontSize: 11.5, fontWeight: 700 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.4, width: 44, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ ...pillStyle, color: kcalColor }}>
        {Math.round(kcal)}<span style={{ fontWeight: 500, color: 'var(--text-hint)' }}> kcal</span>
      </span>
      <span className="c-prot" style={pillStyle}>{proteines.toFixed(1)}g P</span>
      <span className="c-gluc" style={pillStyle}>{glucides.toFixed(1)}g G</span>
      <span className="c-lip"  style={pillStyle}>{lipides.toFixed(1)}g L</span>
      {hint && (
        <span style={{ fontSize: 10.5, color: 'var(--text-hint)', fontWeight: 600 }}>{hint}</span>
      )}
    </div>
  )
}
