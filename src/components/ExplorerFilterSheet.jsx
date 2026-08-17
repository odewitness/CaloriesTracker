import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { CLAIM_GROUPS, DEFAULT_FILTERS, chipLabel, COOKING_OPTIONS } from '../lib/ciqualExplorer'
import ExplorerSheetSection from './ExplorerSheetSection'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerFilterSheet — filtres de l'explorateur Ciqual.
//
// Les pastilles « Riche en… » sont le filtre principal, et pas seulement un
// habillage : un TRI sur un nutriment remonte une poignée d'extrêmes (persil
// séché, foie, acérola), alors qu'un FILTRE renvoie l'ensemble des aliments qui
// dépassent réellement le seuil d'allégation — beaucoup plus exploitable pour
// composer un repas. Seuils = règlement UE n°1924/2006, calculés à partir des
// RNP déjà définis dans nutrients.js (voir getClaimLevel).
//
// Plusieurs pastilles cochées = ET logique (l'aliment doit toutes les vérifier).
//
// Les groupes longs (vitamines, minéraux, catégories) sont repliés par défaut,
// sauf s'ils contiennent déjà un filtre actif — voir ExplorerSheetSection.
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }) {
  return (
    <button
      className="chip"
      onClick={onClick}
      style={active
        ? { background: 'var(--green)', color: 'var(--white)' }
        : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
    >
      {label}
    </button>
  )
}

function ChipGrid({ children }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
}

export default function ExplorerFilterSheet({ filters, categories, onChange, onClose }) {
  useBackButton(onClose)

  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter(x => x !== value) : [...list, value]

  const set = (patch) => onChange({ ...filters, ...patch })

  const activeCount =
    filters.claims.length + filters.categories.length + filters.cooking.length +
    (filters.favoritesOnly ? 1 : 0) + (filters.showSeasonings ? 1 : 0) +
    (filters.fitsRemainingKcal ? 1 : 0)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Filtrer</h2>
          {activeCount > 0 && (
            <button
              className="btn-ghost"
              style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '6px 0' }}
              onClick={() => onChange({ ...DEFAULT_FILTERS, query: filters.query })}
            >
              Tout effacer
            </button>
          )}
        </div>

        {/* ── Riche en… ── */}
        {CLAIM_GROUPS.map(group => {
          const keys = group.fields.map(f => f.key)
          const count = filters.claims.filter(k => keys.includes(k)).length
          return (
            <ExplorerSheetSection
              key={group.label}
              title={`Riche en — ${group.label}`}
              count={count}
              // Les macros sont le point d'entrée le plus courant : elles
              // restent dépliées. Les deux autres groupes ne s'ouvrent d'office
              // que s'ils portent déjà un filtre.
              collapsible={group.label !== 'Macros'}
              defaultOpen={count > 0}
            >
              <ChipGrid>
                {group.fields.map(f => (
                  <Chip
                    key={f.key}
                    label={chipLabel(f)}
                    active={filters.claims.includes(f.key)}
                    onClick={() => set({ claims: toggleIn(filters.claims, f.key) })}
                  />
                ))}
              </ChipGrid>
            </ExplorerSheetSection>
          )
        })}

        {/* ── Cuisson ──
            Déduite du libellé de l'aliment, pas d'une colonne : environ deux
            tiers des aliments Ciqual ne précisent rien et restent affichés
            tant qu'aucune pastille n'est cochée. */}
        <ExplorerSheetSection title="Cuisson">
          <ChipGrid>
            {COOKING_OPTIONS.map(o => (
              <Chip
                key={o.key}
                label={o.label}
                active={filters.cooking.includes(o.key)}
                onClick={() => set({ cooking: toggleIn(filters.cooking, o.key) })}
              />
            ))}
          </ChipGrid>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
            Repérée dans le nom de l'aliment. Beaucoup n'en précisent rien.
          </div>
        </ExplorerSheetSection>

        {/* ── Catégories ── */}
        {categories.length > 0 && (
          <ExplorerSheetSection
            title="Catégories"
            count={filters.categories.length}
            collapsible
            defaultOpen={filters.categories.length > 0}
          >
            <ChipGrid>
              {categories.map(c => (
                <Chip
                  key={c}
                  label={c}
                  active={filters.categories.includes(c)}
                  onClick={() => set({ categories: toggleIn(filters.categories, c) })}
                />
              ))}
            </ChipGrid>
          </ExplorerSheetSection>
        )}

        {/* ── Options ──
            Deux pastilles plutôt que deux lignes à cocher pleine largeur : ce
            sont des filtres comme les autres, ils n'ont pas à occuper quatre
            fois plus de place. La note sur les épices reste, elle : sans elle,
            leur absence de la liste passe pour un bug. */}
        <ExplorerSheetSection title="Options">
          <ChipGrid>
            <Chip
              label="★ Mes favoris"
              active={filters.favoritesOnly}
              onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}
            />
            <Chip
              label="🧂 Afficher les épices"
              active={filters.showSeasonings}
              onClick={() => set({ showSeasonings: !filters.showSeasonings })}
            />
          </ChipGrid>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
            Épices et aides culinaires sont masquées par défaut : 100 g de thym
            séché fausse tous les classements.
          </div>
        </ExplorerSheetSection>

        <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
