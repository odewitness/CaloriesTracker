import React, { useState, useMemo, useEffect } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFavorites } from '../hooks/useFavorites'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { computeTotals } from '../lib/nutrients'
import {
  DEFAULT_FILTERS, DEFAULT_SORT, SORT_BASES,
  filterFoods, sortFoods, findField, fieldValue, formatValue,
  listCategories, getRichClaims, getPortion, getNutrientGaps,
  describeActiveFilters, removeFilter,
} from '../lib/ciqualExplorer'
import NutrientGapsBanner from '../components/NutrientGapsBanner'
import ExplorerFilterSheet from '../components/ExplorerFilterSheet'
import ExplorerSortSheet from '../components/ExplorerSortSheet'
import ExplorerFoodModal from '../components/ExplorerFoodModal'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerPage — parcours de la base Ciqual pour trouver des aliments adaptés
// à un besoin nutritionnel du moment (voir src/lib/ciqualExplorer.js pour la
// logique et les partis pris : bases de comparaison, seuils d'allégation,
// exclusion des épices).
//
// La page s'ouvre sur les manques du jour plutôt que sur une liste vide à
// régler : c'est ce qui en fait un outil de composition de repas et pas un
// simple navigateur de base de données.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_STEP = 50

// Bouton de contrôle "Trier" / "Filtrer" : même gabarit pour les deux, avec
// l'intitulé du réglage au-dessus et sa valeur courante en dessous.
function ControlButton({ icon, caption, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 11px', textAlign: 'left',
        background: 'var(--white)', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? 'var(--green)' : 'var(--border-md)'}`,
        color: active ? 'var(--green-dark)' : 'var(--text-muted)',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 10, color: 'var(--text-hint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      </span>
    </button>
  )
}

// Une ligne de résultat. La valeur mise en avant à droite est celle du tri
// actif (et pas systématiquement les calories) : c'est ce qui explique d'un
// coup d'œil pourquoi l'aliment est classé là.
function ExplorerRow({ food, sortField, base, isFav, onSelect, onToggleFav }) {
  const val = fieldValue(food, sortField, base)
  const claims = getRichClaims(food, 2)
  const baseShort = SORT_BASES.find(b => b.key === base)?.short
  const portion = getPortion(food)

  return (
    <div
      onClick={() => onSelect(food)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(food) }}
        className="btn-icon"
        style={{ flexShrink: 0, color: isFav ? 'var(--amber)' : 'var(--text-hint)' }}
        aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <Star size={16} fill={isFav ? 'var(--amber)' : 'none'} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{food.alim_nom}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {Math.round(food.energie_kcal ?? 0)} kcal/100 g
          {base === 'portion' && portion.declared && ` · ${portion.label}`}
        </div>
        {claims.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {claims.map(c => (
              <span key={c.key} style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tri par nom : aucune valeur a mettre en avant, la ligne reste sobre. */}
      {!sortField.virtual && (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: val == null ? 'var(--text-hint)' : 'var(--green-dark)' }}>
            {formatValue(val, sortField.unit)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>{baseShort}</div>
        </div>
      )}
    </div>
  )
}

export default function ExplorerPage() {
  const { foods, loading, error } = useCiqualCatalog()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { settings } = useSettings()

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const { entries } = useJournal(today)

  // Volontairement NON persistes : la page repart d'un etat neutre a chaque
  // ouverture (tri par nom, aucun filtre). Un reglage pris pour un besoin
  // ponctuel - typiquement une pastille de manque du jour - ne doit pas
  // devenir l'etat permanent de l'onglet.
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [sort, setSort]       = useState(DEFAULT_SORT)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [visible, setVisible]       = useState(PAGE_STEP)

  // Revenir en haut de liste dès qu'on change les critères : garder 300 lignes
  // dépliées après un changement de filtre n'a aucun sens.
  useEffect(() => { setVisible(PAGE_STEP) }, [filters, sort])

  const totals    = useMemo(() => computeTotals(entries), [entries])
  const gaps      = useMemo(() => getNutrientGaps(totals, settings), [totals, settings])
  const remaining = settings?.goal_kcal > 0 ? settings.goal_kcal - totals.kcal : null

  const categories = useMemo(() => listCategories(foods), [foods])
  const sortField  = findField(sort.field)

  const results = useMemo(() => {
    const filtered = filterFoods(foods, filters, { isFavorite, remainingKcal: remaining })
    return sortFoods(filtered, sort)
  }, [foods, filters, sort, isFavorite, remaining])

  // Un favori se pose depuis la ligne allégée, mais `favoris.food_data` est un
  // snapshot jamais rafraîchi côté FoodPicker : on recharge la ligne complète
  // avant de l'enregistrer, sinon le favori réutilisé plus tard aurait des
  // nutriments manquants. Le retrait, lui, ne dépend que de la clé.
  const handleToggleFav = async (food) => {
    if (isFavorite(food)) { toggleFavorite(food); return }
    const { data } = await supabase.from('ciqual').select('*').eq('alim_code', food.alim_code).single()
    toggleFavorite(data ? { ...data, _source: 'ciqual' } : food)
  }

  // Une pastille de manque applique le filtre « riche en » ET bascule le tri
  // sur ce nutriment : c'est le geste attendu (« montre-moi le fer »), en un
  // seul appui plutôt qu'en passant par les deux feuilles de réglages.
  const handlePickGap = (key) => {
    setFilters(f => ({
      ...f,
      claims: f.claims.includes(key) ? f.claims.filter(k => k !== key) : [...f.claims, key],
    }))
    setSort(s => ({ ...s, field: key, dir: 'desc' }))
  }

  const activeFilters = useMemo(() => describeActiveFilters(filters, remaining), [filters, remaining])
  const isDefaultSort = sort.field === DEFAULT_SORT.field && sort.dir === DEFAULT_SORT.dir

  const activeFilterCount =
    filters.claims.length + filters.categories.length +
    (filters.favoritesOnly ? 1 : 0) + (filters.fitsRemainingKcal ? 1 : 0)

  return (
    <div className="page-content" style={{ padding: '12px 16px 24px' }}>
      {/* ── Recherche ── */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }} />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Chercher un aliment…"
          value={filters.query}
          onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
        />
      </div>

      <NutrientGapsBanner
        gaps={gaps}
        hasEntries={entries.length > 0}
        remainingKcal={remaining}
        activeClaims={filters.claims}
        onPickGap={handlePickGap}
        fitsRemainingKcal={filters.fitsRemainingKcal}
        onToggleFits={() => setFilters(f => ({ ...f, fitsRemainingKcal: !f.fitsRemainingKcal }))}
      />

      {/* ── Trier / Filtrer ──
          Deux boutons distincts et de même poids visuel : ce sont deux gestes
          différents (l'un classe, l'autre retire) et les confondre rend la
          page incompréhensible. Chacun affiche son état courant en toutes
          lettres plutôt qu'un simple point de notification. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <ControlButton
          icon={<ArrowUpDown size={14} />}
          caption={sortField.virtual ? 'Trier' : `Trier · ${SORT_BASES.find(b => b.key === sort.base)?.label}`}
          value={sortField.virtual
            ? (sort.dir === 'asc' ? 'Nom A → Z' : 'Nom Z → A')
            : `${sortField.label} ${sort.dir === 'desc' ? '↓' : '↑'}`}
          onClick={() => setSortOpen(true)}
        />
        <ControlButton
          icon={<SlidersHorizontal size={14} />}
          caption="Filtrer"
          value={activeFilterCount ? `${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''}` : 'Aucun'}
          active={activeFilterCount > 0}
          onClick={() => setFilterOpen(true)}
        />
      </div>

      {/* Critères en cours, tous retirables d'un appui — c'est ce qui manquait :
          une liste restreinte par un filtre invisible donne l'impression que le
          tri ne répond plus. Le sens du tri est la première pastille pour que
          l'inversion reste à un seul appui. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <button
          className="chip"
          onClick={() => setSort(s => ({ ...s, dir: s.dir === 'desc' ? 'asc' : 'desc' }))}
          style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
        >
          {sortField.virtual
            ? (sort.dir === 'asc' ? 'A → Z' : 'Z → A')
            : (sort.dir === 'desc' ? '↓ Les + élevés' : '↑ Les - élevés')}
        </button>

        {activeFilters.map(item => (
          <button
            key={item.id}
            className="chip"
            onClick={() => setFilters(f => removeFilter(f, item))}
            style={{ background: 'var(--green-light)', color: 'var(--green-dark)' }}
          >
            {item.label}<span style={{ marginLeft: 6, opacity: 0.6 }}>✕</span>
          </button>
        ))}

        {/* Remet la page dans son état d'ouverture : filtres vidés ET tri
            ramené au nom. Sans la remise à zéro du tri, retirer la dernière
            pastille laisserait la liste classée sur un nutriment sans qu'aucun
            critère ne soit plus visible. */}
        {(activeFilters.length > 0 || !isDefaultSort) && (
          <button
            className="chip"
            onClick={() => { setFilters(f => ({ ...DEFAULT_FILTERS, query: f.query })); setSort(DEFAULT_SORT) }}
            style={{ background: 'transparent', color: 'var(--text-hint)' }}
          >
            Tout effacer
          </button>
        )}
      </div>

      {/* ── Résultats ── */}
      {loading ? <Loader label="Chargement de la base Ciqual…" /> : error ? (
        <EmptyState title="Base indisponible" description="Impossible de charger la base Ciqual pour le moment." />
      ) : results.length === 0 ? (
        <EmptyState title="Aucun aliment" description="Aucun aliment ne correspond à ces critères. Essaie d'enlever un filtre." />
      ) : (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 2 }}>
            {results.length} aliment{results.length > 1 ? 's' : ''}
          </div>
          {results.slice(0, visible).map(food => (
            <ExplorerRow
              key={food.alim_code || food.id}
              food={food}
              sortField={sortField}
              base={sort.base}
              isFav={isFavorite(food)}
              onSelect={setSelected}
              onToggleFav={handleToggleFav}
            />
          ))}
          {visible < results.length && (
            <button
              className="btn-ghost"
              style={{ width: '100%', marginTop: 12, color: 'var(--green-dark)', fontWeight: 600 }}
              onClick={() => setVisible(v => v + PAGE_STEP)}
            >
              Afficher plus
            </button>
          )}
        </>
      )}

      {filterOpen && (
        <ExplorerFilterSheet
          filters={filters}
          categories={categories}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {sortOpen && (
        <ExplorerSortSheet sort={sort} onChange={setSort} onClose={() => setSortOpen(false)} />
      )}
      {selected && (
        <ExplorerFoodModal food={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
