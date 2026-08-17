import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { SORT_GROUPS, SORT_BASES, findField, chipLabel, naturalDir, KCAL_REF_OPTIONS, DEFAULT_KCAL_REF } from '../lib/ciqualExplorer'
import ExplorerSheetSection from './ExplorerSheetSection'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerSortSheet — construit le tri en trois temps, dans l'ordre où la
// phrase se lit : « trier par PROTÉINES, à CALORIES ÉGALES, les PLUS ÉLEVÉS
// d'abord ». Les étapes sont numérotées parce que la deuxième (la base de
// comparaison) n'est pas un réglage évident : c'est elle qui décide si le
// classement remonte des poudres déshydratées ou des aliments d'assiette.
//
// Le nutriment est présenté en deux niveaux (groupe → nutriment) plutôt qu'en
// une liste à plat de 33 pastilles, comme FoodSortModal pour les aliments
// personnalisés. Vitamines et minéraux sont repliés par défaut : ce sont 23
// pastilles qui repoussaient autrement les étapes 2 et 3 hors de l'écran. Le
// groupe du tri en cours, lui, s'ouvre toujours — sinon on ne verrait pas sur
// quoi la liste est classée.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HINTS = {
  g100:    "À poids égal : pour 100 g de chaque aliment. Fait remonter les produits très concentrés (poudres, graines) dont on ne mange que quelques grammes.",
  kcal100: "« Pour le même budget de calories, lequel m'apporte le plus ? ». Chaque ligne indique la quantité à manger pour ce budget. Le classement reste le même quel que soit le nombre de kcal choisi — seuls les chiffres changent. Les aliments trop peu caloriques (eaux, sodas light, bouillons) ne sont pas comparables ainsi et partent en fin de liste.",
  portion: "Ce qu'apporte une portion usuelle de chaque aliment. Le plus proche de la réalité de l'assiette.",
}

function StepTitle({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
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
            ...(grow ? { flex: 1, minWidth: 0, padding: '6px 8px', textAlign: 'center' } : null),
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
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Trier les aliments</h2>

        {/* ── 1. Quoi ── */}
        <StepTitle n="1">Trier par</StepTitle>
        {SORT_GROUPS.map(group => {
          const inGroup = group.fields.some(f => f.key === sort.field)
          const long = group.label === 'Vitamines' || group.label === 'Minéraux'
          return (
            <ExplorerSheetSection
              key={group.label}
              title={group.label}
              count={inGroup && long ? 1 : 0}
              collapsible={long}
              defaultOpen={inGroup}
            >
              <ChipRow
                options={group.fields.map(f => ({ key: f.key, label: chipLabel(f) }))}
                selected={sort.field}
                // Changer de champ repart sur son sens naturel (voir naturalDir) ;
                // retoucher le champ deja actif conserve le sens choisi.
                onPick={key => onChange({
                  ...sort,
                  field: key,
                  dir: key === sort.field ? sort.dir : naturalDir(key),
                })}
              />
            </ExplorerSheetSection>
          )
        })}

        {/* ── 2. Comment comparer ── */}
        {!isName && (
          <div style={{ marginTop: 16 }}>
            <StepTitle n="2">Comparer</StepTitle>
            <ChipRow
              grow
              options={SORT_BASES.map(b => ({ key: b.key, label: b.label }))}
              selected={sort.base}
              onPick={key => onChange({ ...sort, base: key })}
            />
            {/* Budget calorique de reference : ne change pas l'ordre du
                classement (tout est multiplie par le meme facteur), mais rend
                les quantites parlantes — 200 kcal est plus proche d'une
                collation reelle que 100 kcal. */}
            {sort.base === 'kcal100' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginBottom: 5 }}>Budget de calories</div>
                <ChipRow
                  grow
                  options={KCAL_REF_OPTIONS.map(k => ({ key: k, label: `${k} kcal` }))}
                  selected={sort.kcalRef ?? DEFAULT_KCAL_REF}
                  onPick={key => onChange({ ...sort, kcalRef: key })}
                />
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8, lineHeight: 1.45 }}>
              {BASE_HINTS[sort.base]}
            </div>
          </div>
        )}

        {/* ── 3. Sens ── */}
        <div style={{ marginTop: 16 }}>
          <StepTitle n={isName ? '2' : '3'}>Sens</StepTitle>
          <ChipRow
            grow
            options={dirOptions}
            selected={sort.dir}
            onPick={key => onChange({ ...sort, dir: key })}
          />
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
