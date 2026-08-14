import React from 'react'
import { CHANGELOG } from '../lib/changelog'

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Fil conducteur des nouveautés, groupées par date (la plus récente en
// premier — CHANGELOG est déjà trié ainsi dans src/lib/changelog.js).
export default function WhatsNewPage() {
  const dates = [...new Set(CHANGELOG.map(e => e.date))]

  return (
    <div className="page-content" style={{ padding: '16px 16px 40px' }}>
      {dates.map(date => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div className="section-title">{formatDate(date)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHANGELOG.filter(e => e.date === date).map((entry, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{entry.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.4 }}>{entry.description}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
