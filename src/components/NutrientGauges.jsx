import React from 'react'

function fmtVal(val, unit) {
  if (val == null) return '—'
  return `${val < 1 && val > 0 ? val.toFixed(2) : Math.round(val * 10) / 10} ${unit}`
}

// Un nutriment "limite" (sodium, sel...) : dépasser la référence est ce qu'on veut
// éviter, donc la jauge se colore en rouge en approchant/dépassant 100%.
// Un nutriment "apport" classique (vitamines, calcium...) : la référence est un
// minimum à atteindre, donc la jauge se colore en rouge en dessous, verte une fois
// atteinte. Dans les deux cas, dépasser le seuil de sécurité (lss) déclenche l'alerte.
function FieldGauge({ field, value, hasEntries }) {
  const { label, ref, lss, unit, limite } = field
  const pct = hasEntries ? (value / ref) * 100 : 0
  const barPct = Math.min(100, pct)
  const overLss = lss != null && hasEntries && value > lss

  let color
  if (!hasEntries) color = 'var(--text-hint)'
  else if (overLss) color = 'var(--coral)'
  else if (limite) color = pct >= 100 ? 'var(--coral)' : pct >= 80 ? 'var(--amber)' : '#1D9E75'
  else color = pct >= 100 ? '#1D9E75' : pct >= 60 ? 'var(--amber)' : 'var(--coral)'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {hasEntries ? `${overLss ? '⚠︎ ' : ''}${fmtVal(value, unit)} · ${Math.round(pct)}%` : 'N/D'}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

// fields: VITAMIN_FIELDS ou MINERAL_FIELDS (cf lib/nutrients.js)
// totals: objet { [key]: valeur_par_jour }
// hasEntries: false tant qu'aucune donnée sur la période
export default function NutrientGauges({ fields, totals, hasEntries }) {
  return (
    <div>
      {fields.map(f => (
        <FieldGauge key={f.key} field={f} value={totals[f.key] ?? 0} hasEntries={hasEntries} />
      ))}
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 2 }}>
        % des repères Anses (RNP/AS adulte). ⚠︎ = au-dessus de la limite de sécurité connue.
      </div>
    </div>
  )
}
