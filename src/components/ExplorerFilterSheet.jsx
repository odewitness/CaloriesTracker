import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { CLAIM_GROUPS, DEFAULT_FILTERS, chipLabel } from '../lib/ciqualExplorer'

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
// ─────────────────────────────────────────────────────────────────────────────

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <button
      onClick={onChange}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        border: `1.5px solid ${checked ? 'var(--green)' : 'var(--border-md)'}`,
        background: checked ? 'var(--green)' : 'transparent',
        color: 'var(--white)', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked ? '✓' : ''}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>{hint}</span>}
      </span>
    </button>
  )
}

export default function ExplorerFilterSheet({ filters, categories, onChange, onClose }) {
  useBackButton(onClose)

  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter(x => x !== value) : [...list, value]

  const set = (patch) => onChange({ ...filters, ...patch })

  const activeCount =
    filters.claims.length + filters.categories.length +
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
              style={{ fontSize: 12.5, color: 'var(--text-muted)' }}
              onClick={() => onChange({ ...DEFAULT_FILTERS, query: filters.query })}
            >
              Tout effacer
            </button>
          )}
        </div>

        {/* ── Riche en… ── */}
        {CLAIM_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              Riche en — {group.label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.fields.map(f => {
                const active = filters.claims.includes(f.key)
                return (
                  <button
                    key={f.key}
                    className="chip"
                    onClick={() => set({ claims: toggleIn(filters.claims, f.key) })}
                    style={active
                      ? { background: 'var(--green)', color: 'var(--white)' }
                      : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                  >
                    {chipLabel(f)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* ── Catégories ── */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
              Catégories
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.map(c => {
                const active = filters.categories.includes(c)
                return (
                  <button
                    key={c}
                    className="chip"
                    onClick={() => set({ categories: toggleIn(filters.categories, c) })}
                    style={active
                      ? { background: 'var(--green)', color: 'var(--white)' }
                      : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Options ── */}
        <div style={{ marginBottom: 16 }}>
          <ToggleRow
            label="Seulement mes favoris"
            hint="Les aliments marqués d'une étoile"
            checked={filters.favoritesOnly}
            onChange={() => set({ favoritesOnly: !filters.favoritesOnly })}
          />
          <ToggleRow
            label="Afficher épices et aides culinaires"
            hint="Masquées par défaut : 100 g de thym séché fausse tous les classements"
            checked={filters.showSeasonings}
            onChange={() => set({ showSeasonings: !filters.showSeasonings })}
          />
        </div>

        <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
