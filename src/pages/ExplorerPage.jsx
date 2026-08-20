import React, { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, SlidersHorizontal, ArrowUpDown, Star, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFavorites, foodIdentity } from '../hooks/useFavorites'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { computeTotals, scaleFood } from '../lib/nutrients'
import { getNutriBadge } from '../lib/nutriBadge'
import { getFoodCategoryIcon, getFoodCategoryColor } from '../lib/categoryIcons'
import {
  DEFAULT_FILTERS, DEFAULT_SORT,
  filterFoods, sortFoods, findField, fieldValue, formatValue,
  listCategories, getRichMicroClaims, getPortion, getNutrientGaps,
  describeActiveFilters, removeFilter, gramsForKcal, hasDeclaredPortion,
  getCategoryLabel, describeBase, baseShortLabel, getGapAmount, gapCoverage,
  POPULARITY_FIELD, suggestCombo,
} from '../lib/ciqualExplorer'
import NutrientGapsBanner from '../components/NutrientGapsBanner'
import AllGapsSheet from '../components/AllGapsSheet'
import ExplorerFilterSheet from '../components/ExplorerFilterSheet'
import ExplorerSortSheet from '../components/ExplorerSortSheet'
import ExplorerFoodModal from '../components/ExplorerFoodModal'
import ComboSuggestion from '../components/ComboSuggestion'
import AddToJournalSheet from '../components/AddToJournalSheet'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { useToast } from '../lib/toast'

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
function ExplorerRow({ food, sortField, sort, isFav, onSelect, onToggleFav, gapFields, remainingKcal, usage, onQuickAdd }) {
  const { base, kcalRef } = sort
  const val = fieldValue(food, sortField, base, kcalRef)
  const portion = getPortion(food)
  const gramsRef = gramsForKcal(food, kcalRef)

  // Grammage nécessaire pour combler, à la fois, tous les manques du jour
  // cochés en pastille tout en tenant dans les calories restantes — actif
  // seulement quand les deux critères sont réunis (voir ExplorerPage).
  // Indépendant du tri affiché : remplace la valeur de tri habituelle, qui
  // répondrait à une question différente (« combien pour 100 g ») et pas à
  // celle posée ici (« combien manger de cet aliment précis, là,
  // maintenant, pour combler ce que je vise »).
  const coverage = gapFields.length ? gapCoverage(food, gapFields, remainingKcal) : null
  const isPopularitySort = sort.field === POPULARITY_FIELD.key

  // Grammage proposé pour l'ajout rapide : la quantité qui comble le manque
  // visé quand elle existe (la réponse la plus directe à la question posée),
  // sinon la portion usuelle de l'aliment — jamais 100 g par défaut sans le
  // dire, cf. getPortion().
  const quickAddGrams = coverage ? coverage.grams : portion.g

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
        <div style={{ display: 'flex', gap: 2 }}>
          {/* Ajout direct sans passer par la fiche : la grammage proposé est
              déjà la réponse la plus utile visible sur la carte (comble le
              manque, ou portion usuelle) — rouvrir la fiche pour la
              retaper serait un détour inutile la plupart du temps. La
              feuille jour/repas/quantité reste un appui plus loin pour
              ajuster avant de confirmer. */}
          <button
            onClick={e => { e.stopPropagation(); onQuickAdd(food, quickAddGrams) }}
            style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            aria-label={`Ajouter ${food.alim_nom} au journal`}
          >
            <Plus size={15} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onToggleFav(food) }}
            className="btn-icon"
            style={{ width: 24, height: 24, color: isFav ? 'var(--amber)' : 'var(--text-hint)' }}
            aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star size={15} fill={isFav ? 'var(--amber)' : 'none'} />
          </button>
        </div>

        {/* Le grammage « comble le(s) manque(s) » prime sur tout le reste et
            s'affiche même en tri par nom (aucune valeur de tri à montrer
            sinon) : c'est une réponse plus directe à la question posée par
            les deux critères cochés ensemble. En tri « Les plus utilisés »,
            c'est le compteur d'usage qui remplace la valeur nutritionnelle —
            c'est lui qui explique le classement affiché. */}
        {coverage ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: coverage.pct >= 100 ? 'var(--green-dark)' : 'var(--amber)' }}>
              {formatValue(coverage.grams, 'g')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>
              {coverage.pct >= 100
                ? (gapFields.length > 1 ? 'comble tes manques' : 'comble le manque')
                : (gapFields.length > 1 ? `${coverage.pct} % des manques` : `${coverage.pct} % du manque`)}
            </div>
          </div>
        ) : isPopularitySort ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: usage?.count ? 'var(--green-dark)' : 'var(--text-hint)' }}>
              {usage?.count ? `${usage.count}×` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>
              {usage?.count ? 'fois utilisé' : 'jamais utilisé'}
            </div>
          </div>
        ) : !sortField.virtual && (
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
  const location = useLocation()
  const { foods, loading, error } = useCiqualCatalog()
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { settings } = useSettings()
  const toast = useToast()

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const { entries } = useJournal(today)

  // Ouverture depuis une pastille de manque de la page du jour (voir
  // TodayGapsSection / TodayPage.goToExplorerGap) : amorce exactement le même
  // état que si on avait tapé la pastille équivalente ici (voir
  // handlePickGap plus bas). Lu une seule fois au montage — n'affecte pas la
  // règle juste en dessous, qui ne vaut que pour les ouvertures normales.
  const initialGapKey = location.state?.gapKey

  // Volontairement NON persistes : la page repart d'un etat neutre a chaque
  // ouverture (tri par nom, aucun filtre) SAUF amorçage ci-dessus. Un reglage
  // pris pour un besoin ponctuel - typiquement une pastille de manque du jour
  // - ne doit pas devenir l'etat permanent de l'onglet.
  const [filters, setFilters] = useState(() =>
    initialGapKey ? { ...DEFAULT_FILTERS, claims: [initialGapKey] } : DEFAULT_FILTERS
  )
  const [sort, setSort] = useState(() =>
    initialGapKey ? { ...DEFAULT_SORT, field: initialGapKey, dir: 'desc' } : DEFAULT_SORT
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen]     = useState(false)
  const [selected, setSelected]     = useState(null)
  const [visible, setVisible]       = useState(PAGE_STEP)
  const [gapsSheetOpen, setGapsSheetOpen] = useState(false)
  // Ajout rapide depuis une carte ou une suggestion combo (voir handleQuickAdd)
  // : { food, full, qty, date, meal, saving }. `full` arrive après coup (la
  // ligne du catalogue est allégée, cf. EXPLORER_SELECT) — la feuille
  // s'affiche déjà pendant que la ligne complète charge, `saving` bloque
  // juste la confirmation tant qu'elle n'est pas là.
  const [quickAdd, setQuickAdd] = useState(null)

  // Revenir en haut de liste dès qu'on change les critères : garder 300 cartes
  // dépliées après un changement de filtre n'a aucun sens.
  useEffect(() => { setVisible(PAGE_STEP) }, [filters, sort])

  const { addEntry: addQuickEntry } = useJournal(quickAdd?.date ?? today)

  const totals    = useMemo(() => computeTotals(entries), [entries])
  // Version plafonnée (bande du haut + alternative sur la fiche aliment,
  // toutes deux volontairement limitées aux manques les plus urgents) et
  // version complète (feuille « … », voir AllGapsSheet) — même source, deux
  // limites différentes plutôt que deux logiques de calcul distinctes.
  const gaps      = useMemo(() => getNutrientGaps(totals, settings), [totals, settings])
  const allGaps   = useMemo(() => getNutrientGaps(totals, settings, Infinity), [totals, settings])
  const remaining = settings?.goal_kcal > 0 ? settings.goal_kcal - totals.kcal : null

  const categories = useMemo(() => listCategories(foods), [foods])
  const sortField  = findField(sort.field)

  // Table d'usage par aliment (compteur + dernière fois), dérivée des favoris
  // — c'est là que vit `use_count`/`last_used_at` (voir bumpFavoriteUsage
  // dans useFavorites.js), Explorer n'a pas sa propre notion d'usage. Un
  // aliment jamais favori n'a simplement pas d'entrée : getUsage() renvoie
  // alors null, traité comme « jamais utilisé ».
  const usageMap = useMemo(() => {
    const m = new Map()
    for (const f of favorites) {
      m.set(`${f.food_source}:${f.food_ref_id ?? f.food_name}`, { count: f.use_count || 0, lastUsed: f.last_used_at })
    }
    return m
  }, [favorites])
  const getUsage = (food) => usageMap.get(foodIdentity(food).key) || null

  // Le grammage « comble le(s) manque(s) » ne s'active que si « tient dans mes
  // calories restantes » est coché, et porte sur TOUS les nutriments
  // actuellement filtrés en « riche en » qui sont encore un manque réel
  // aujourd'hui (getGapAmount > 0). Indépendant du tri : sélectionner deux
  // manques doit combiner les deux dans le grammage affiché, que la liste
  // soit triée sur l'un, l'autre, ou par nom (voir gapCoverage).
  const gapFields = useMemo(() => {
    if (!filters.fitsRemainingKcal) return []
    return filters.claims
      .map(findField)
      .filter(f => !f.virtual)
      .map(field => ({ field, missing: getGapAmount(totals, settings, field) }))
      .filter(g => g.missing > 0)
  }, [filters.fitsRemainingKcal, filters.claims, totals, settings])

  const results = useMemo(() => {
    let list = filterFoods(foods, filters, { isFavorite, remainingKcal: remaining })
    // Classement par portion : seuls les aliments ayant une portion renseignée
    // en base sont comparables entre eux (voir hasDeclaredPortion). Ne
    // s'applique qu'aux nutriments réels : `base` peut valoir 'portion' en
    // reliquat d'un tri précédent même une fois basculé sur un champ virtuel
    // (Nom, Popularité) — l'étape « Comparer » qui le pilote est alors
    // masquée dans ExplorerSortSheet, donc rien ne permet de le corriger
    // depuis l'interface. Sans ce garde-fou, la liste resterait filtrée par
    // un critère invisible et sans rapport avec le tri affiché.
    if (sort.base === 'portion' && !sortField.virtual) list = list.filter(hasDeclaredPortion)
    return sortFoods(list, sort, getUsage)
  }, [foods, filters, sort, isFavorite, remaining, usageMap, sortField])

  // Suggestion à deux aliments (voir suggestCombo) : ne s'affiche que si AUCUN
  // aliment des résultats actuels ne comble déjà bien les manques cochés tout
  // seul — sinon elle ferait doublon avec le grammage déjà visible sur les
  // cartes (coverage). Cherche d'abord la meilleure couverture atteignable en
  // un seul aliment ; ne calcule la combinaison à deux (plus coûteux) que si
  // elle a une chance d'apporter un vrai progrès.
  const comboSuggestion = useMemo(() => {
    if (!gapFields.length || remaining == null || remaining <= 0) return null
    let bestSinglePct = 0
    for (const food of results) {
      const c = gapCoverage(food, gapFields, remaining)
      if (c && c.pct > bestSinglePct) bestSinglePct = c.pct
      if (bestSinglePct >= 100) break
    }
    if (bestSinglePct >= 100) return null
    const combo = suggestCombo(results, gapFields, remaining)
    // Marge de 5 points : sous ce seuil, la combinaison n'apporte pas assez
    // par rapport au meilleur aliment seul pour justifier une suggestion à
    // part, qui a un coût de lecture (deux aliments à peser plutôt qu'un).
    if (!combo || combo.pct <= bestSinglePct + 5) return null
    return combo
  }, [gapFields, remaining, results])

  // Un favori se pose depuis la ligne allégée, mais `favoris.food_data` est un
  // snapshot jamais rafraîchi côté FoodPicker : on recharge la ligne complète
  // avant de l'enregistrer, sinon le favori réutilisé plus tard aurait des
  // nutriments manquants. Le retrait, lui, ne dépend que de la clé.
  const handleToggleFav = async (food) => {
    if (isFavorite(food)) { toggleFavorite(food); return }
    const { data } = await supabase.from('ciqual').select('*').eq('alim_code', food.alim_code).single()
    toggleFavorite(data ? { ...data, _source: 'ciqual' } : food)
  }

  // Ajout direct depuis une carte (ou une suggestion combo), sans passer par
  // la fiche détaillée : ouvre tout de suite la feuille jour/repas/quantité,
  // pré-remplie avec le grammage déjà visible sur la carte, et va chercher la
  // ligne `ciqual` complète en tâche de fond (même besoin que handleToggleFav
  // — scaleFood() a besoin de tous les nutriments, pas juste la projection
  // allégée du catalogue).
  const handleQuickAdd = (food, grams) => {
    setQuickAdd({ food, full: null, qty: String(Math.max(1, Math.round(grams))), date: today, meal: 'Déjeuner', saving: false })
    supabase.from('ciqual').select('*').eq('alim_code', food.alim_code).single().then(({ data }) => {
      setQuickAdd(q => (q && q.food.alim_code === food.alim_code) ? { ...q, full: data ? { ...data, _source: 'ciqual' } : null } : q)
    })
  }

  const confirmQuickAdd = async () => {
    if (!quickAdd?.full) return
    const q = parseFloat(quickAdd.qty)
    if (!q || q <= 0) { toast('Indique une quantité'); return }
    setQuickAdd(qa => ({ ...qa, saving: true }))
    const { error } = await addQuickEntry({ meal: quickAdd.meal, ...scaleFood(quickAdd.full, q) })
    if (error) { toast("Erreur à l'ajout au journal"); setQuickAdd(qa => ({ ...qa, saving: false })); return }
    toast(`${quickAdd.food.alim_nom} ajouté à ${quickAdd.meal}`)
    setQuickAdd(null)
  }

  // Une pastille de manque applique le filtre « riche en » ET bascule le tri
  // sur ce nutriment : c'est le geste attendu (« montre-moi le fer »), en un
  // seul appui plutôt qu'en passant par les deux feuilles de réglages.
  //
  // Ça ne vaut que pour l'ACTIVATION. Au retrait, forcer quand même le tri sur
  // ce nutriment le laissait braqué dessus alors qu'il n'était plus dans les
  // filtres — plus aucun manque actif ne correspondait alors au tri, et le
  // grammage « comble le manque » disparaissait silencieusement.
  // Au retrait, on ne touche au tri que s'il pointait justement sur ce
  // nutriment : on retombe alors sur un autre manque encore actif, ou sur le
  // tri par défaut s'il n'en reste plus aucun.
  const handlePickGap = (key) => {
    const turningOn = !filters.claims.includes(key)
    setFilters(f => ({
      ...f,
      claims: turningOn ? [...f.claims, key] : f.claims.filter(k => k !== key),
    }))
    if (turningOn) {
      setSort(s => ({ ...s, field: key, dir: 'desc' }))
    } else {
      setSort(s => {
        if (s.field !== key) return s
        const remaining = filters.claims.filter(k => k !== key)
        return remaining.length
          ? { ...s, field: remaining[remaining.length - 1], dir: 'desc' }
          : DEFAULT_SORT
      })
    }
  }

  const activeFilters = useMemo(() => describeActiveFilters(filters, remaining), [filters, remaining])
  const isDefaultSort =
    sort.field === DEFAULT_SORT.field && sort.dir === DEFAULT_SORT.dir && sort.base === DEFAULT_SORT.base

  // La popularité est un champ « virtuel » comme le nom (pas une colonne
  // ciqual, cf. POPULARITY_FIELD), mais contrairement au nom c'est un VRAI
  // parti pris de tri, pas l'état neutre par défaut — le bouton "Trier" et
  // le sens du tri doivent donc le traiter comme un nutriment, pas comme
  // l'absence de tri.
  const isPopularitySort = sort.field === POPULARITY_FIELD.key

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
        hasMoreGaps={allGaps.length > gaps.length}
        onShowAllGaps={() => setGapsSheetOpen(true)}
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
          label={sortField.virtual && !isPopularitySort ? 'Trier' : `${sortField.label} ${sort.dir === 'desc' ? '↓' : '↑'}`}
          active={!sortField.virtual || isPopularitySort}
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
          {sortField.virtual && !isPopularitySort
            ? (sort.dir === 'asc' ? 'A → Z' : 'Z → A')
            : isPopularitySort
              ? (sort.dir === 'desc' ? '↓ Les + utilisés' : '↑ Les - utilisés')
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
          {comboSuggestion && (
            <ComboSuggestion combo={comboSuggestion} onQuickAdd={handleQuickAdd} />
          )}

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
              gapFields={gapFields}
              remainingKcal={remaining}
              usage={getUsage(food)}
              onQuickAdd={handleQuickAdd}
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
        <ExplorerFoodModal
          food={selected}
          onClose={() => setSelected(null)}
          foods={foods}
          gaps={gaps}
          onPickFood={setSelected}
        />
      )}
      {gapsSheetOpen && (
        <AllGapsSheet
          gaps={allGaps}
          activeClaims={filters.claims}
          onPick={handlePickGap}
          onClose={() => setGapsSheetOpen(false)}
        />
      )}
      {quickAdd && (
        <AddToJournalSheet
          nom={quickAdd.food.alim_nom}
          qty={quickAdd.qty}
          onQtyChange={q => setQuickAdd(qa => ({ ...qa, qty: q }))}
          journalDate={quickAdd.date}
          onDateChange={d => setQuickAdd(qa => ({ ...qa, date: d }))}
          journalMeal={quickAdd.meal}
          onMealChange={m => setQuickAdd(qa => ({ ...qa, meal: m }))}
          onConfirm={quickAdd.saving || !quickAdd.full ? () => {} : confirmQuickAdd}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  )
}
