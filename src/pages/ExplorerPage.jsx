import React, { useState, useMemo, useEffect } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFavorites } from '../hooks/useFavorites'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { computeTotals } from '../lib/nutrients'
import { getNutriBadge } from '../lib/nutriBadge'
import { getFoodCategoryIcon, getFoodCategoryColor } from '../lib/categoryIcons'
import {
  DEFAULT_FILTERS, DEFAULT_SORT,
  filterFoods, sortFoods, findField, fieldValue, formatValue,
  listCategories, getRichMicroClaims, getPortion, getNutrientGaps,
  describeActiveFilters, removeFilter, gramsForKcal, hasDeclaredPortion,
  getCategoryLabel, describeBase, baseShortLabel,
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
//
// Tout l'en-tête (recherche, manques, réglages, critères actifs) est tenu au
// plus court possible : sur un écran de téléphone, chaque ligne de réglage en
// moins est une carte d'aliment de plus visible sans faire défiler. Les
// réglages détaillés vivent dans les deux feuilles (tri / filtres) ; la page
// n'en garde que l'état courant, sous forme de pastilles retirables.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_STEP = 50

// Bouton de contrôle « Trier » / « Filtrer » : une seule ligne, pour que les
// deux tiennent côte à côte sans manger de hauteur. Le bouton de tri affiche
// le nutriment courant (l'information la plus utile), celui des filtres un
// compteur — le détail est de toute façon repris juste en dessous en
// pastilles retirables.
function ControlButton({ icon, label, badge, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 10px',
        background: active ? 'var(--green-light)' : 'var(--white)',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? 'var(--green)' : 'var(--border-md)'}`,
        color: active ? 'var(--green-dark)' : 'var(--text)',
        fontSize: 13, fontWeight: 700,
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {badge != null && (
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
          background: 'var(--green)', color: 'var(--white)', fontSize: 10, fontWeight: 700,
        }}>
          {badge}
        </span>
      )}
    </button>
  )
}

// Une carte de résultat. La valeur mise en avant à droite est celle du tri
// actif (et pas systématiquement les calories) : c'est ce qui explique d'un
// coup d'œil pourquoi l'aliment est classé là.
//
// Le passage de la ligne séparée par un filet à la carte n'est pas décoratif :
// une carte tient ensemble un aliment et TOUT ce qui le décrit (catégorie,
// badge, valeur du tri), là où une suite de filets donnait un mur de texte où
// rien n'accrochait l'œil.
function ExplorerRow({ food, sortField, sort, isFav, onSelect, onToggleFav }) {
  const { base, kcalRef } = sort
  const val = fieldValue(food, sortField, base, kcalRef)
  const portion = getPortion(food)
  const gramsRef = gramsForKcal(food, kcalRef)

  // Un seul badge macro (même règle et même rendu que les cartes d'aliments et
  // de recettes ailleurs dans l'app), plus au maximum une allégation
  // micro-nutriment, qui n'est visible nulle part ailleurs.
  const badge = getNutriBadge(food)
  const micro = getRichMicroClaims(food, 1)[0]

  const category = getCategoryLabel(food.categorie)
  const catColor = getFoodCategoryColor(category)

  return (
    <div
      onClick={() => onSelect(food)}
      className="card"
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', marginBottom: 8, cursor: 'pointer' }}
    >
      {/* Pastille de catégorie : repère visuel immédiat dans une liste longue,
          et rappel de la famille de l'aliment que le nom seul ne donne pas
          toujours (« Doliques, cuites »). */}
      <div
        style={{
          flexShrink: 0, width: 42, height: 42, borderRadius: 12,
          background: catColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 19,
        }}
        aria-hidden="true"
      >
        {getFoodCategoryIcon(category)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{food.alim_nom}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {/* Chaque mode annonce la quantité sur laquelle la carte est
              calculée — sans elle, la valeur de droite n'est pas
              interprétable. En mode densité c'est ce qu'il faut manger pour le
              budget de calories choisi ; en mode portion, la portion elle-même
              et ce qu'elle coûte en calories. */}
          {base === 'kcal100' && gramsRef != null ? (
            `${Math.round(gramsRef)} g pour ${kcalRef} kcal`
          ) : base === 'portion' ? (
            <>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{portion.label}</span>
              {` · ${Math.round((food.energie_kcal ?? 0) * portion.g / 100)} kcal`}
            </>
          ) : (
            `${Math.round(food.energie_kcal ?? 0)} kcal/100 g`
          )}
        </div>

        {(badge || micro) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {badge && (
              <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                {badge.emoji} {badge.label}
              </span>
            )}
            {micro && (
              <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                {/* « Riche en » écrit en toutes lettres : à côté du badge macro,
                    une pastille disant seulement « Zinc » ne dit pas si c'est
                    une qualité ou une simple mention. Seule l'initiale passe en
                    minuscule — « vitamine C » perdrait sa lettre autrement. */}
                Riche en {micro.label.charAt(0).toLowerCase()}{micro.label.slice(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleFav(food) }}
          className="btn-icon"
          style={{ width: 26, height: 26, color: isFav ? 'var(--amber)' : 'var(--text-hint)' }}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star size={16} fill={isFav ? 'var(--amber)' : 'none'} />
        </button>

        {/* Tri par nom : aucune valeur à mettre en avant, la carte reste sobre. */}
        {!sortField.virtual && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: val == null ? 'var(--text-hint)' : 'var(--green-dark)' }}>
              {formatValue(val, sortField.unit)}
            </div>
            {/* En mode portion, le grammage exact vaut mieux que le mot
                « portion » : c'est la seule façon de savoir à quoi la valeur
                au-dessus correspond. */}
            <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>
              {base === 'portion' ? `pour ${portion.g} g` : baseShortLabel(sort)}
            </div>
          </div>
        )}
      </div>
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

  // Revenir en haut de liste dès qu'on change les critères : garder 300 cartes
  // dépliées après un changement de filtre n'a aucun sens.
  useEffect(() => { setVisible(PAGE_STEP) }, [filters, sort])

  const totals    = useMemo(() => computeTotals(entries), [entries])
  const gaps      = useMemo(() => getNutrientGaps(totals, settings), [totals, settings])
  const remaining = settings?.goal_kcal > 0 ? settings.goal_kcal - totals.kcal : null

  const categories = useMemo(() => listCategories(foods), [foods])
  const sortField  = findField(sort.field)

  const results = useMemo(() => {
    let list = filterFoods(foods, filters, { isFavorite, remainingKcal: remaining })
    // Classement par portion : seuls les aliments ayant une portion renseignée
    // en base sont comparables entre eux (voir hasDeclaredPortion).
    if (sort.base === 'portion') list = list.filter(hasDeclaredPortion)
    return sortFoods(list, sort)
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
  const isDefaultSort =
    sort.field === DEFAULT_SORT.field && sort.dir === DEFAULT_SORT.dir && sort.base === DEFAULT_SORT.base

  const activeFilterCount =
    filters.claims.length + filters.categories.length + filters.cooking.length +
    (filters.favoritesOnly ? 1 : 0) + (filters.fitsRemainingKcal ? 1 : 0)

  return (
    <div className="page-content" style={{ padding: '12px 16px 24px' }}>
      {/* ── Recherche ── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
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
          page incompréhensible. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <ControlButton
          icon={<ArrowUpDown size={14} />}
          label={sortField.virtual ? 'Trier' : `${sortField.label} ${sort.dir === 'desc' ? '↓' : '↑'}`}
          active={!sortField.virtual}
          onClick={() => setSortOpen(true)}
        />
        <ControlButton
          icon={<SlidersHorizontal size={14} />}
          label="Filtrer"
          badge={activeFilterCount || null}
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

        {/* La base de comparaison change complètement le classement : elle doit
            rester lisible sur la page, et pas seulement au fond de la feuille
            de tri. Un appui la ramène au /100 g, comme n'importe quel autre
            critère de cette rangée. */}
        {!sortField.virtual && sort.base !== DEFAULT_SORT.base && (
          <button
            className="chip"
            onClick={() => setSort(s => ({ ...s, base: DEFAULT_SORT.base }))}
            style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
          >
            {describeBase(sort)}<span style={{ marginLeft: 6, opacity: 0.6 }}>✕</span>
          </button>
        )}

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
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>
            {results.length} aliment{results.length > 1 ? 's' : ''}
            {sort.base === 'portion' && ' ayant une portion renseignée'}
          </div>
          {results.slice(0, visible).map(food => (
            <ExplorerRow
              key={food.alim_code || food.id}
              food={food}
              sortField={sortField}
              sort={sort}
              isFav={isFavorite(food)}
              onSelect={setSelected}
              onToggleFav={handleToggleFav}
            />
          ))}
          {visible < results.length && (
            <button
              className="btn-ghost"
              style={{ width: '100%', marginTop: 4, color: 'var(--green-dark)', fontWeight: 600 }}
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
