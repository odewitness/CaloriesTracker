import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_GROUPS, SORT_BASES, findField } from '../lib/ciqualExplorer'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerSortSheet — construit le tri en trois temps, dans l'ordre où la
// phrase se lit : « trier par PROTÉINES, à CALORIES ÉGALES, les PLUS ÉLEVÉS
// d'abord ». Les étapes sont numérotées parce que la deuxième (la base de
// comparaison) n'est pas un réglage évident : c'est elle qui décide si le
// classement remonte des poudres déshydratées ou des aliments d'assiette.
//
// Le nutriment est présenté en deux niveaux (groupe → nutriment) plutôt qu'en
// une liste à plat de 33 pastilles, comme FoodSortModal pour les aliments
// personnalisés.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HINTS = {
  g100:    "À poids égal : pour 100 g de chaque aliment. Fait remonter les produits très concentrés (poudres, graines) dont on ne mange que quelques grammes.",
  kcal100: "« Pour le même nombre de calories, lequel m'apporte le plus ? ». Chaque ligne indique la quantité à manger pour atteindre ces 100 kcal. Les aliments trop peu caloriques (eaux, sodas light, bouillons) ne sont pas comparables ainsi et partent en fin de liste.",
  portion: "Ce qu'apporte une portion usuelle de chaque aliment. Le plus proche de la réalité de l'assiette.",
}

function StepTitle({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <span style={{
        width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
        background: 'var(--green-light)', color: 'var(--green-dark)',
        fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {children}
      </span>
    </div>
  )
}

function ChipRow({ options, selected, onPick, grow }) {
  return (
    <div style={{ display: 'flex', flexWrap: grow ? 'nowrap' : 'wrap', gap: 6 }}>
      {options.map(o => (
        <button
          key={o.key}
          className="chip"
          onClick={() => onPick(o.key)}
          style={{
            ...(grow ? { flex: 1, minWidth: 0 } : null),
            ...(selected === o.key
              ? { background: 'var(--green)', color: 'var(--white)' }
              : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }),
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ExplorerSortSheet({ sort, onChange, onClose }) {
  useBackButton(onClose)

  // Trier par nom ne compare aucune valeur : la base de comparaison n'a alors
  // rien à piloter, on masque l'étape plutôt que de laisser un réglage sans effet.
  const isName = findField(sort.field).virtual

  const dirOptions = isName
    ? [{ key: 'asc', label: 'A → Z' }, { key: 'desc', label: 'Z → A' }]
    : [{ key: 'desc', label: `Les + élevés d'abord` }, { key: 'asc', label: `Les - élevés d'abord` }]

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Trier les aliments</h2>

        {/* ── 1. Quoi ── */}
        <StepTitle n="1">Trier par</StepTitle>
        {SORT_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginBottom: 5 }}>{group.label}</div>
            <ChipRow
              options={group.fields.map(f => ({ key: f.key, label: f.label }))}
              selected={sort.field}
              onPick={key => onChange({ ...sort, field: key })}
            />
          </div>
        ))}

        {/* ── 2. Comment comparer ── */}
        {!isName && (
          <div style={{ marginTop: 18 }}>
            <StepTitle n="2">Comparer</StepTitle>
            <ChipRow
              grow
              options={SORT_BASES.map(b => ({ key: b.key, label: b.label }))}
              selected={sort.base}
              onPick={key => onChange({ ...sort, base: key })}
            />
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8, lineHeight: 1.45 }}>
              {BASE_HINTS[sort.base]}
            </div>
          </div>
        )}

        {/* ── 3. Sens ── */}
        <div style={{ marginTop: 18 }}>
          <StepTitle n={isName ? '2' : '3'}>Sens</StepTitle>
          <ChipRow
            grow
            options={dirOptions}
            selected={sort.dir}
            onPick={key => onChange({ ...sort, dir: key })}
          />
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 22 }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
