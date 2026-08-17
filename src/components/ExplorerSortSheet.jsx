import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_GROUPS, SORT_BASES } from '../lib/ciqualExplorer'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerSortSheet — choix du nutriment de tri, du sens, et surtout de la
// BASE de comparaison (/100 g, /100 kcal, /portion), qui est le réglage le plus
// structurant de l'explorateur : c'est lui qui décide si le classement remonte
// des épices déshydratées ou des aliments réellement mangeables.
//
// Deux niveaux (groupe → nutriment) plutôt qu'une liste à plat de 32 pastilles,
// comme FoodSortModal pour les aliments personnalisés.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HINTS = {
  g100:    'Classement brut. Fait remonter les aliments très concentrés (épices, poudres) qu\'on ne mange pas en quantité.',
  kcal100: 'Densité nutritionnelle : le plus de nutriment pour le moins de calories. Le mode le plus utile pour enrichir sans alourdir.',
  portion: 'Ce qu\'une portion usuelle apporte vraiment. Remet les condiments à leur place.',
}

export default function ExplorerSortSheet({ sort, onChange, onClose }) {
  useBackButton(onClose)

  const pickField = (key) => onChange({ ...sort, field: key })

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Trier les aliments</h2>

        {/* ── Base de comparaison ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Comparer
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {SORT_BASES.map(b => (
            <button
              key={b.key}
              className="chip"
              onClick={() => onChange({ ...sort, base: b.key })}
              style={sort.base === b.key
                ? { background: 'var(--green)', color: 'var(--white)', flex: 1 }
                : { background: 'var(--gray-bg)', color: 'var(--text-muted)', flex: 1 }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 18, lineHeight: 1.45 }}>
          {BASE_HINTS[sort.base]}
        </div>

        {/* ── Sens ── */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Sens
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {[
            { dir: 'desc', label: `Les + élevés d'abord` },
            { dir: 'asc',  label: `Les - élevés d'abord` },
          ].map(o => (
            <button
              key={o.dir}
              className="chip"
              onClick={() => onChange({ ...sort, dir: o.dir })}
              style={sort.dir === o.dir
                ? { background: 'var(--green)', color: 'var(--white)', flex: 1 }
                : { background: 'var(--gray-bg)', color: 'var(--text-muted)', flex: 1 }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Nutriment ── */}
        {SORT_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              {group.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.fields.map(f => (
                <button
                  key={f.key}
                  className="chip"
                  onClick={() => pickField(f.key)}
                  style={sort.field === f.key
                    ? { background: 'var(--green)', color: 'var(--white)' }
                    : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
