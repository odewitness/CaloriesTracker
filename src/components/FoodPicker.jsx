import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Search, ScanLine, Camera, ArrowLeft, Star, Pencil, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { useFavorites, foodIdentity } from '../hooks/useFavorites'
import { useRecentFoods } from '../hooks/useRecentFoods'
import { patchCachedPortions } from '../hooks/useCiqualCatalog'
import BarcodeScanner from './BarcodeScanner'
import { useBackButton } from '../hooks/useBackButton'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { mapOFFProduct } from '../lib/openFoodFacts'
import { COMPLEMENT_CATEGORY } from '../lib/foodCategories'
import { getComplementNutrients } from '../lib/complementNutrients'
import MacroPreview from './MacroPreview'
import ComplementNutrientPills from './ComplementNutrientPills'
import RecipeQuantityAdjustModal from './RecipeQuantityAdjustModal'
import FoodRow from './FoodRow'
import FavSortToggle from './FavSortToggle'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// FoodPicker — composant unique de recherche + configuration de grammage
// pour un aliment. Utilisé par AddFoodModal (ajout au journal) ET par
// RecipeFormModal (ajout d'un ingrédient à une recette) : mêmes favoris,
// mêmes récents, même recherche Ciqual/OFF, même code-barres.
//
// Props :
//   title          — titre affiché en haut de l'étape recherche
//   confirmLabel   — libellé du bouton de validation (ex: "Ajouter au journal")
//   contextLabel   — ligne optionnelle affichée sous la config (ex: "Ajout à : Déjeuner")
//   includeRecipes — si false, les recettes n'apparaissent pas dans les résultats
//                    (évite d'imbriquer une recette dans une autre recette)
//   onConfirm(food, qty) — appelé à la validation ; le CALLER se charge de
//                          transformer (food, qty) en objet persistable via
//                          scaleFood() de lib/nutrients.js, avec ses propres
//                          champs additionnels (meal, recette_id...)
//   onClose        — ferme le picker
// ─────────────────────────────────────────────────────────────────────────────

const FAVORITES_STEP = 20

// Réessaie jusqu'à 3 fois (avec un court délai) en cas de réponse HTTP non-2xx
// avant d'abandonner — cf. commentaire dans doSearch sur la fiabilité de
// l'API Open Food Facts.
async function fetchOFFWithRetry(url, attempts = 3) {
  let lastStatus
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    lastStatus = res.status
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Open Food Facts indisponible (${lastStatus})`)
}

export default function FoodPicker({
  title = 'Ajouter un aliment',
  confirmLabel = 'Ajouter',
  contextLabel,
  includeRecipes = true,
  onConfirm,
  onClose,
}) {
  useBackButton(onClose)
  const toast = useToast()
  const { user } = useAuth()
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { recents } = useRecentFoods()
  const [step, setStep] = useState('search') // search | configure
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState("100")
  // Pour un complément alimentaire, l'utilisateur pense en "nombre de doses"
  // (ex: 2 gélules) plutôt qu'en grammes — `qty` reste la source de vérité en
  // grammes (utilisée par scaleFood/MacroPreview), mais ce texte séparé porte
  // la saisie du nombre de doses, synchronisée avec `qty` via `doseUnitG`.
  const [doseCountText, setDoseCountText] = useState('1')
  const [subtractMode, setSubtractMode] = useState(false)
  const [grossWeight, setGrossWeight] = useState("")
  const [wasteWeight, setWasteWeight] = useState("")
  const [barcode, setBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [adjustingRecipeQty, setAdjustingRecipeQty] = useState(false)
  const [searchSource, setSearchSource] = useState('ciqual') // 'ciqual' | 'off'
  const [offBrandFilter, setOffBrandFilter] = useState('')
  const [offCategoryFilter, setOffCategoryFilter] = useState('')
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [favoritesVisible, setFavoritesVisible] = useState(FAVORITES_STEP)
  const [favSort, setFavSort] = useState('most') // 'recent' | 'alpha' | 'most'
  const [favSortDir, setFavSortDir] = useState('desc') // 'asc' | 'desc'
  // Édition des portions courantes d'un aliment ciqual — même geste que sur
  // la fiche de l'Explorer (ExplorerFoodModal), mais accessible directement
  // au moment d'ajouter l'aliment au suivi, sans repasser par Explorer.
  const [editingPortions, setEditingPortions] = useState(false)
  const [portionsDraft, setPortionsDraft] = useState([{ label: '', g: '' }])
  const [savingPortions, setSavingPortions] = useState(false)
  const searchRef = useRef(null)
  const timerRef = useRef(null)

  // Un aliment favori reste affiché dans les récents (l'utilisateur veut voir
  // les deux). Quand un récent correspond à un favori, on fusionne les portions
  // recommandées du favori (stockées dans food_data) avec la "Dernière quantité"
  // venant du journal, sans que l'une efface l'autre.
  const favoriteByKey = new Map(favorites.map(f => [`${f.food_source}:${f.food_ref_id ?? f.food_name}`, f]))
  const recentByKey = new Map(recents.map(r => [foodIdentity(r).key, r]))

  // Fusionne deux jeux de portions sans dupliquer les grammages déjà présents.
  // Le premier jeu passé garde la priorité, donc devient la portion par
  // défaut à l'ouverture de l'étape "configure" (cf. selectFood → portions[0]).
  function mergePortions(priorityPortions, extraPortions) {
    const extra = (extraPortions || []).filter(p => !priorityPortions.some(pp => pp.g === p.g))
    return [...priorityPortions, ...extra]
  }

  // "Récents" = dernière utilisation réelle (last_used_at, alimenté par
  // bumpFavoriteUsage à chaque ajout au journal) ; un favori jamais utilisé
  // retombe sur sa date d'ajout aux favoris (created_at). Chaque mode a un
  // sens "naturel" par défaut (recent/most = décroissant, alpha = A→Z) ;
  // favSortDir permet de l'inverser sans changer de mode.
  const sortedFavorites = useMemo(() => {
    const arr = [...favorites]
    const mult = favSortDir === 'asc' ? 1 : -1
    if (favSort === 'alpha') {
      arr.sort((a, b) => mult * (a.food_name || '').localeCompare(b.food_name || '', 'fr'))
    } else if (favSort === 'most') {
      arr.sort((a, b) => mult * ((a.use_count || 0) - (b.use_count || 0)))
    } else {
      arr.sort((a, b) => mult * (new Date(a.last_used_at || a.created_at) - new Date(b.last_used_at || b.created_at)))
    }
    return arr
  }, [favorites, favSort, favSortDir])

  // Cliquer sur le mode déjà actif inverse son sens ; changer de mode
  // repart sur le sens naturel de ce nouveau mode.
  const NATURAL_FAV_SORT_DIR = { recent: 'desc', alpha: 'asc', most: 'desc' }
  const handleFavSortChange = (id) => {
    if (id === favSort) {
      setFavSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setFavSort(id)
      setFavSortDir(NATURAL_FAV_SORT_DIR[id])
    }
  }

  // Un favori aussi présent dans les récents doit proposer en priorité la
  // dernière quantité réellement utilisée — sinon la ligne "★ Favoris"
  // rouvre toujours sur la portion "de base" enregistrée à la création du
  // favori (food_data n'est jamais mis à jour après coup).
  const favoritesMerged = sortedFavorites.map(f => {
    const recent = recentByKey.get(`${f.food_source}:${f.food_ref_id ?? f.food_name}`)
    if (!recent) return f.food_data
    return { ...f.food_data, portions: mergePortions(recent.portions, f.food_data.portions) }
  })

  const recentsMerged = recents.map(r => {
    const fav = favoriteByKey.get(foodIdentity(r).key)
    if (!fav) return r
    return { ...r, portions: mergePortions(r.portions, fav.food_data.portions) }
  })

  // Revenir à la limite de base dès qu'on change le tri des favoris : garder
  // une liste dépliée après un changement de critère n'a aucun sens.
  useEffect(() => { setFavoritesVisible(FAVORITES_STEP) }, [favSort, favSortDir])

  // Pas d'autofocus à l'ouverture — évite l'ouverture automatique du clavier sur mobile.
  // Le focus est déclenché uniquement quand l'utilisateur revient à l'étape search
  // depuis l'étape configure (retour arrière).
  useEffect(() => {
    if (step !== 'search') return
    if (!selected) return
    const t = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [step])

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)

    if (searchSource === 'off') {
      try {
        // Le moteur de recherche d'Open Food Facts (world.openfoodfacts.org)
        // répond régulièrement en 503 par intermittence (vérifié manuellement :
        // environ un essai sur deux échoue, y compris sur son API v2 — pas un
        // souci réseau côté client). Un simple retry avec petit délai suffit
        // dans la grande majorité des cas. Le moteur plus récent
        // (search.openfoodfacts.org) est plus fiable mais ne renvoie pas
        // d'en-tête CORS pour notre origine : inutilisable depuis le navigateur.
        const data = await fetchOFFWithRetry(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,product_name_fr,categories,brands,nutriments,serving_size`
        )
        const products = (data.products || [])
          .filter(p => p.product_name || p.product_name_fr)
          .map(mapOFFProduct)
        setResults(products)
        setOffBrandFilter('')
        setOffCategoryFilter('')
      } catch {
        toast('Open Food Facts est temporairement indisponible, réessaie dans un instant')
        setResults([])
      }
      setSearching(false)
      return
    }

    // Ciqual + aliments custom (+ recettes si autorisées)
    const { data, error } = await supabase.rpc('search_ciqual', { query: q, lim: 25 })
    if (error) console.error('search_ciqual error:', error)

    const { data: custom } = await supabase
      .from('aliments_custom')
      .select('*')
      .eq('user_id', user.id)
      .ilike('nom', `%${q}%`)
      .limit(5)
    const customMapped = (custom || []).map(c => ({
      ...c,
      alim_nom: c.nom,
      categorie: c.categorie || 'Personnalisé',
      _source: 'custom',
      _fresh: true, // déjà lu en direct depuis aliments_custom — pas besoin de re-fetch dans selectFood
    }))

    let recettesMapped = []
    if (includeRecipes) {
      const { data: recettes } = await supabase
        .from('recettes')
        .select('*')
        .eq('user_id', user.id)
        .ilike('nom', `%${q}%`)
        .limit(5)
      recettesMapped = (recettes || []).map(r => ({
        ...r,
        id:        r.id,
        alim_nom:  r.nom,
        categorie: `Recette · ${r.portions || 1} portion${r.portions > 1 ? 's' : ''}`,
        portions: r.poids_cuit_g || r.poids_cru_g
          ? [{
              label: `1 portion (${Math.round((r.poids_cuit_g || r.poids_cru_g) / (r.portions || 1))} g)`,
              g: Math.round((r.poids_cuit_g || r.poids_cru_g) / (r.portions || 1)),
            }]
          : [],
        _source: 'recette',
      }))
    }

    const ciqualResults = data || []
    setResults([...ciqualResults, ...customMapped, ...recettesMapped])
    setSearching(false)
  }, [user, searchSource, includeRecipes])

  const handleQuery = (v) => {
    setQuery(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 250)
  }

  // Effacer les résultats et relancer la recherche quand on change de source
  useEffect(() => {
    setResults([])
    setOffBrandFilter('')
    setOffCategoryFilter('')
    if (query.length >= 2) doSearch(query)
  }, [searchSource])

  // Marques/catégories disponibles pour filtrer les résultats OFF affichés —
  // calculées côté client à partir du lot déjà récupéré (25 résultats max).
  // Pas d'appel réseau supplémentaire : l'API de facettes la plus fiable
  // d'Open Food Facts (search.openfoodfacts.org) ne renvoie pas d'en-tête
  // CORS pour notre origine (vérifié manuellement), donc inutilisable ici.
  const offBrandOptions = useMemo(() => {
    if (searchSource !== 'off') return []
    const counts = new Map()
    for (const f of results) {
      if (!f.marque) continue
      counts.set(f.marque, (counts.get(f.marque) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [results, searchSource])

  const offCategoryOptions = useMemo(() => {
    if (searchSource !== 'off') return []
    const counts = new Map()
    for (const f of results) {
      if (!f.categorie) continue
      counts.set(f.categorie, (counts.get(f.categorie) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [results, searchSource])

  const offFilteredResults = useMemo(() => {
    if (searchSource !== 'off') return results
    return results.filter(f =>
      (!offBrandFilter || f.marque === offBrandFilter) &&
      (!offCategoryFilter || f.categorie === offCategoryFilter)
    )
  }, [results, searchSource, offBrandFilter, offCategoryFilter])

  // Entrée = lance la recherche immédiatement et ferme le clavier
  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    clearTimeout(timerRef.current)
    doSearch(query)
    e.currentTarget.blur()
  }

  const fetchBarcode = async (codeOverride) => {
    const code = (codeOverride ?? barcode).trim()
    if (!code) return
    setBarcodeLoading(true)
    try {
      const data = await fetchOFFWithRetry(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      if (data.status === 1 && data.product) {
        selectFood(mapOFFProduct(data.product))
      } else {
        toast('Produit non trouvé dans Open Food Facts')
      }
    } catch {
      toast('Open Food Facts est temporairement indisponible, réessaie dans un instant')
    }
    setBarcodeLoading(false)
  }

  // remplace la fonction selectFood existante par celle-ci (devient async)
const selectFood = async (food) => {
  let enriched = food

  // Une recette venant de la recherche n'a que les macros de base stockées
  // sur `recettes` (cf. saveRecette) — on recalcule son per100g complet
  // (vitamines/minéraux inclus) depuis ses ingrédients avant de l'utiliser,
  // pour rester cohérent avec ce qu'affiche RecipeDetailModal.
  if (food._source === 'recette' && food.id) {
    const { data: ingredients } = await supabase
      .from('recette_ingredients')
      .select('*')
      .eq('recette_id', food.id)
      .eq('user_id', user.id)
    const totaux = sumIngredients(ingredients || [])
    const poidsRef = food.poids_cuit_g || food.poids_cru_g
    const per100 = calcPer100g(totaux, poidsRef)
    if (per100) enriched = { ...food, ...per100 }
  }

  // Un aliment perso venant des Favoris (snapshot figé à la création du
  // favori, jamais mis à jour) ou des Récents (categorie forcée à 'Récent'
  // pour l'affichage, portions remplacées par une "Dernière quantité"
  // synthétique — voir useRecentFoods) peut être périmé ou catégorisé à
  // tort. On retombe sur la vraie ligne aliments_custom, en particulier pour
  // que categorie/portions pilotent correctement l'UI dose-based des
  // compléments alimentaires plus bas.
  if (food._source === 'custom' && food.id && !food._fresh) {
    const { data: fresh } = await supabase
      .from('aliments_custom')
      .select('*')
      .eq('id', food.id)
      .eq('user_id', user.id)
      .single()
    if (fresh) {
      const isComp = fresh.categorie === COMPLEMENT_CATEGORY
      enriched = {
        ...fresh,
        alim_nom: fresh.nom,
        categorie: fresh.categorie || 'Personnalisé',
        _source: 'custom',
        // Pour un complément, les portions viennent uniquement de la dose +
        // portions courantes définies sur l'aliment (portions[0] doit rester
        // la vraie dose pour que le calcul du nombre de doses reste juste) —
        // on ignore la "Dernière quantité"/les portions favorites fusionnées
        // en amont. Pour un aliment normal, on les garde en priorité (la
        // dernière quantité utilisée reste proposée par défaut, comme avant).
        portions: isComp ? fresh.portions : mergePortions(food.portions || [], fresh.portions || []),
      }
    }
  }

  setSelected(enriched)
  const isComp = enriched.categorie === COMPLEMENT_CATEGORY
  if (isComp) {
    // Portion par défaut = la "portion courante" (portions[1]) si elle existe,
    // sinon la dose seule (portions[0]) — cohérent avec la carte Aliments.
    const doseUnit = enriched.portions?.[0]?.g || 1
    const defaultPortion = enriched.portions?.[1]?.g ?? enriched.portions?.[0]?.g ?? doseUnit
    setQty(String(defaultPortion))
    setDoseCountText(String(Math.round((defaultPortion / doseUnit) * 100) / 100))
  } else {
    const defaultPortion = enriched.portions?.[0]?.g || 100
    setQty(String(defaultPortion))
    setDoseCountText('1')
  }
  setSubtractMode(false)
  setGrossWeight("")
  setWasteWeight("")
  setEditingPortions(false)
  setStep('configure')
}

const isComplementFood = selected?.categorie === COMPLEMENT_CATEGORY
// Poids d'une dose = 1ère "portion" de l'aliment (voir CustomFoodsSection —
// portions[0] est toujours la dose de base pour un complément).
const doseUnitG = isComplementFood ? (selected.portions?.[0]?.g || 1) : null

// Portions éditables uniquement pour un aliment ciqual : `_source` est vide
// sur les lignes venues de search_ciqual (voir doSearch) et vaut 'ciqual' par
// défaut ailleurs dans l'app (cf. useFavorites) — les aliments personnalisés
// se modifient déjà depuis l'onglet Aliments, les recettes et les produits
// Open Food Facts n'ont pas de portions librement éditables ici.
const isCiqualFood = !isComplementFood && (selected?._source || 'ciqual') === 'ciqual' && !!selected?.alim_code

const startEditPortions = () => {
  const current = selected?.portions
  setPortionsDraft(
    Array.isArray(current) && current.length
      ? current.map(p => ({ label: p.label || '', g: p.g != null ? String(p.g) : '' }))
      : [{ label: '', g: '' }]
  )
  setEditingPortions(true)
}
const addPortionDraft    = () => setPortionsDraft(p => [...p, { label: '', g: '' }])
const removePortionDraft = (i) => setPortionsDraft(p => p.filter((_, idx) => idx !== i))
const updatePortionDraft = (i, k, v) => setPortionsDraft(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

const savePortions = async () => {
  const clean = portionsDraft
    .filter(p => p.label.trim() && parseFloat(p.g) > 0)
    .map(p => ({ label: p.label.trim(), g: parseFloat(p.g) }))
  setSavingPortions(true)
  const { error } = await supabase.from('ciqual').update({ portions: clean }).eq('alim_code', selected.alim_code)
  setSavingPortions(false)
  if (error) { toast('Erreur lors de la sauvegarde des portions'); return }
  setSelected(s => ({ ...s, portions: clean }))
  patchCachedPortions(selected.alim_code, clean)
  setEditingPortions(false)
  toast('Portions mises à jour')
}

// Change le nombre de doses (bouton −/+ ou saisie directe) : recalcule `qty`
// (grammes, source de vérité pour scaleFood) à partir du nombre de doses.
const setDoseCount = (text) => {
  setDoseCountText(text)
  const n = parseFloat(text)
  if (!isNaN(n) && n >= 0) setQty(String(n * doseUnitG))
}

  const handleScanDetected = (code) => {
    setScannerOpen(false)
    setBarcode(code)
    fetchBarcode(code)
  }

  const confirm = async () => {
    if (!selected) return
    await onConfirm(selected, parseFloat(qty) || 0)
    onClose()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        {step === 'configure' ? (
          <button className="btn-icon" onClick={() => setStep('search')} style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div style={{ width: 32, flexShrink: 0 }} />
        )}
        <h2>{step === 'search' ? title : selected?.alim_nom}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {step === 'configure' && selected && (
            <button
              className="btn-icon"
              onClick={() => toggleFavorite(selected)}
              style={{ color: isFavorite(selected) ? 'var(--amber)' : 'var(--text-muted)' }}
              aria-label={isFavorite(selected) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Star size={18} fill={isFavorite(selected) ? 'var(--amber)' : 'none'} />
            </button>
          )}
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
      </div>

      <div className="page-modal-body">
        {step === 'search' && (
          <>
            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
              <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={searchRef}
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder={searchSource === 'off' ? 'Nutella, Activia, Président...' : 'Poulet, riz, pomme...'}
                value={query}
                onChange={e => handleQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                enterKeyHint="search"
                inputMode="search"
              />
            </div>

            {/* Source toggle */}
            <div style={{
              display: 'flex',
              background: 'var(--gray-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: 3,
              marginBottom: 10,
              flexShrink: 0,
              gap: 3,
            }}>
              {[
                { id: 'ciqual', label: '🥦 Ciqual', sublabel: 'Base ANSES' },
                { id: 'off',    label: '🌍 Open Food Facts', sublabel: 'Produits emballés' },
              ].map(src => {
                const active = searchSource === src.id
                return (
                  <button
                    key={src.id}
                    onClick={() => setSearchSource(src.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      padding: '7px 6px',
                      borderRadius: 7,
                      background: active
                        ? (src.id === 'off' ? 'var(--blue)' : 'var(--green)')
                        : 'transparent',
                      color: active ? 'white' : 'var(--text-muted)',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font)',
                      transition: 'all .15s',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{src.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, opacity: active ? 0.85 : 0.6 }}>{src.sublabel}</span>
                  </button>
                )
              })}
            </div>

            {/* Barcode row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanLine size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Code-barres..."
                  type="number"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    fetchBarcode()
                    e.currentTarget.blur()
                  }}
                  enterKeyHint="go"
                />
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 9, padding: '0 12px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                aria-label="Activer la caméra"
              >
                <Camera size={18} />
              </button>
              <button
                onClick={() => fetchBarcode()}
                disabled={barcodeLoading}
                style={{ background: 'var(--green)', color: 'white', borderRadius: 9, padding: '0 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', flexShrink: 0, opacity: barcodeLoading ? 0.6 : 1 }}
              >
                {barcodeLoading ? '...' : 'OK'}
              </button>
            </div>

            {/* Results — scrollable, prend tout l'espace restant */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {searching && <Loader label="Recherche..." />}

              {!searching && searchSource === 'off' && results.length > 0 && (offBrandOptions.length > 1 || offCategoryOptions.length > 1) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexShrink: 0 }}>
                  {offBrandOptions.length > 1 && (
                    <select
                      className="input"
                      style={{ flex: 1, fontSize: 12.5, padding: '8px 10px' }}
                      value={offBrandFilter}
                      onChange={e => setOffBrandFilter(e.target.value)}
                    >
                      <option value="">Toutes les marques</option>
                      {offBrandOptions.map(([brand, count]) => (
                        <option key={brand} value={brand}>{brand} ({count})</option>
                      ))}
                    </select>
                  )}
                  {offCategoryOptions.length > 1 && (
                    <select
                      className="input"
                      style={{ flex: 1, fontSize: 12.5, padding: '8px 10px' }}
                      value={offCategoryFilter}
                      onChange={e => setOffCategoryFilter(e.target.value)}
                    >
                      <option value="">Toutes les catégories</option>
                      {offCategoryOptions.map(([cat, count]) => (
                        <option key={cat} value={cat}>{cat} ({count})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {!searching && query.length >= 2 && results.length === 0 && (
                <EmptyState>
                  {searchSource === 'off'
                    ? `Aucun résultat dans Open Food Facts pour « ${query} »`
                    : `Aucun résultat pour « ${query} »`}
                </EmptyState>
              )}

              {!searching && query.length >= 2 && results.length > 0 && offFilteredResults.length === 0 && (
                <EmptyState>Aucun résultat avec ces filtres</EmptyState>
              )}

              {!searching && query.length >= 2 && offFilteredResults.map((food, i) => (
                <FoodRow
                  key={food.id || food.alim_code || i}
                  food={food}
                  isFav={isFavorite(food)}
                  onSelect={selectFood}
                  onToggleFav={toggleFavorite}
                />
              ))}

              {!searching && query.length < 2 && (
                <>
                  {searchSource === 'ciqual' && favorites.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 8 }}>
                        <button
                          onClick={() => setFavoritesCollapsed(c => !c)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          <span className="section-title" style={{ margin: 0 }}>★ Favoris</span>
                          <span style={{ fontSize: 12, color: 'var(--text-hint)', fontWeight: 600 }}>
                            {favorites.length}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                            {favoritesCollapsed ? '▸' : '▾'}
                          </span>
                        </button>
                        {!favoritesCollapsed && favorites.length > 1 && (
                          <FavSortToggle value={favSort} dir={favSortDir} onChange={handleFavSortChange} />
                        )}
                      </div>
                      {!favoritesCollapsed && sortedFavorites.slice(0, favoritesVisible).map((f, i) => (
                        <FoodRow
                          key={f.id}
                          food={favoritesMerged[i]}
                          isFav={true}
                          onSelect={selectFood}
                          onToggleFav={() => toggleFavorite(f.food_data)}
                        />
                      ))}
                      {!favoritesCollapsed && favoritesVisible < sortedFavorites.length && (
                        <button
                          className="btn-ghost"
                          style={{ width: '100%', marginTop: 4, marginBottom: 4, color: 'var(--green-dark)', fontWeight: 600 }}
                          onClick={() => setFavoritesVisible(v => v + FAVORITES_STEP)}
                        >
                          Afficher plus ({sortedFavorites.length - favoritesVisible} restants)
                        </button>
                      )}
                    </>
                  )}

                  {searchSource === 'ciqual' && recentsMerged.length > 0 && (
                    <>
                      <div className="section-title" style={{ marginTop: favorites.length > 0 ? 16 : 4 }}>Récents (100 dernières entrées)</div>
                      {recentsMerged.map((food, i) => (
                        <FoodRow
                          key={i}
                          food={food}
                          isFav={isFavorite(food)}
                          onSelect={selectFood}
                          onToggleFav={toggleFavorite}
                        />
                      ))}
                    </>
                  )}

                  {(searchSource === 'off' || (favorites.length === 0 && recentsMerged.length === 0)) && (
                    <EmptyState>
                      {searchSource === 'off'
                        ? 'Tape le nom d\'un produit emballé (marque, référence…)'
                        : 'Tape au moins 2 caractères'}
                    </EmptyState>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {step === 'configure' && selected && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{selected.categorie}</div>

            {isComplementFood ? (
              <>
                {/* Portions chips — pas de grammage affiché, ça n'a pas de sens pour un complément */}
                {selected.portions?.length > 1 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>Portions courantes</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selected.portions.map((p, i) => (
                        <button key={i} className="chip" onClick={() => setDoseCount(String(p.g / doseUnitG))}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nombre de doses */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>
                    Nombre de doses ({selected.portions?.[0]?.label || '1 dose'})
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn-icon"
                      style={{ background: 'var(--gray-bg)' }}
                      onClick={() => setDoseCount(String(Math.max(0, (parseFloat(doseCountText) || 0) - 1)))}
                    >−</button>
                    <input
                      className="input-sm"
                      type="text"
                      inputMode="decimal"
                      value={doseCountText}
                      onChange={e => setDoseCount(e.target.value)}
                      style={{ width: 60, textAlign: 'center' }}
                    />
                    <button
                      className="btn-icon"
                      style={{ background: 'var(--gray-bg)' }}
                      onClick={() => setDoseCount(String((parseFloat(doseCountText) || 0) + 1))}
                    >+</button>
                  </div>
                </div>

                {/* Aperçu %AJR — les macros n'ont pas d'intérêt pour un complément */}
                {(() => {
                  const nutrients = getComplementNutrients(selected, (parseFloat(qty) || 0) / 100)
                  return (
                    <div style={{ marginBottom: 16 }}>
                      {nutrients.length > 0 ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <ComplementNutrientPills nutrients={nutrients} />
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune vitamine ou minéral renseigné</div>
                      )}
                    </div>
                  )
                })()}
              </>
            ) : (
              <>
                {/* Portions chips — éditables pour un aliment ciqual (voir isCiqualFood) */}
                {(selected.portions?.length > 0 || isCiqualFood) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Portions courantes</div>
                      {isCiqualFood && !editingPortions && (
                        <button
                          onClick={startEditPortions}
                          style={{ color: 'var(--green)', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Pencil size={12} /> Modifier
                        </button>
                      )}
                    </div>

                    {!editingPortions ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.portions.map((p, i) => (
                          <button key={i} className="chip" onClick={() => setQty(String(p.g))}>
                            {p.label} · {p.g}g
                          </button>
                        ))}
                        <button className="chip" onClick={() => setQty('100')}>100g</button>
                      </div>
                    ) : (
                      <>
                        {portionsDraft.map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <input
                              className="input"
                              placeholder="Ex: 1 tranche"
                              value={p.label}
                              onChange={e => updatePortionDraft(i, 'label', e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <input
                              className="input"
                              type="number"
                              placeholder="g"
                              value={p.g}
                              onChange={e => updatePortionDraft(i, 'g', e.target.value)}
                              style={{ width: 70 }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>g</span>
                            {portionsDraft.length > 1 && (
                              <button onClick={() => removePortionDraft(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>
                            )}
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <button
                            onClick={addPortionDraft}
                            style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <PlusCircle size={14} /> Ajouter
                          </button>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                            <button onClick={() => setEditingPortions(false)} style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>
                              Annuler
                            </button>
                            <button
                              className="btn-primary"
                              onClick={savePortions}
                              disabled={savingPortions}
                              style={{ padding: '7px 16px', fontSize: 12.5, opacity: savingPortions ? 0.7 : 1 }}
                            >
                              {savingPortions ? '...' : 'Enregistrer'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Recette : possibilité de corriger le grammage de certains
                    ingrédients pour cette fois, sans toucher à la recette */}
                {selected._source === 'recette' && (
                  <button
                    onClick={() => setAdjustingRecipeQty(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      marginBottom: 14, padding: '9px 12px', width: '100%',
                      background: 'var(--gray-bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600,
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <Pencil size={14} />
                    Modifier les quantités des ingrédients
                  </button>
                )}

                {/* Toggle mode soustraction */}
                <button
                  onClick={() => {
                    const next = !subtractMode
                    setSubtractMode(next)
                    if (!next) { setGrossWeight(""); setWasteWeight("") }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 14, padding: '9px 12px',
                    background: subtractMode ? 'var(--amber-light)' : 'var(--gray-bg)',
                    border: `1px solid ${subtractMode ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)', width: '100%',
                    color: subtractMode ? 'var(--amber)' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
                    transition: 'all .15s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>⚖️</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {subtractMode ? 'Mode soustraction actif' : 'Peser avec soustraction'}
                  </span>
                  <span style={{
                    width: 32, height: 18, borderRadius: 9, flexShrink: 0,
                    background: subtractMode ? 'var(--amber)' : 'var(--border-md)',
                    position: 'relative', transition: 'background .15s',
                  }}>
                    <span style={{
                      position: 'absolute', top: 2, left: subtractMode ? 16 : 2,
                      width: 14, height: 14, borderRadius: '50%', background: 'white',
                      transition: 'left .15s',
                    }} />
                  </span>
                </button>

                {subtractMode ? (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Poids brut (avec os / peau)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            className="input-sm" type="text" inputMode="decimal" placeholder="—"
                            value={grossWeight}
                            onChange={e => {
                              const g = e.target.value; setGrossWeight(g)
                              const net = (parseFloat(g) || 0) - (parseFloat(wasteWeight) || 0)
                              if (net > 0) setQty(String(net))
                            }}
                            style={{ width: 72 }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>g</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 20, color: 'var(--text-hint)', paddingBottom: 6, flexShrink: 0 }}>−</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Déchet (os, peau…)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            className="input-sm" type="text" inputMode="decimal" placeholder="—"
                            value={wasteWeight}
                            onChange={e => {
                              const w = e.target.value; setWasteWeight(w)
                              const net = (parseFloat(grossWeight) || 0) - (parseFloat(w) || 0)
                              if (net > 0) setQty(String(net))
                            }}
                            style={{ width: 72 }}
                          />
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>g</span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, paddingBottom: 6, fontSize: 20, color: 'var(--text-hint)' }}>=</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Net consommé</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 72, textAlign: 'center', padding: '8px 4px',
                            background: 'var(--amber-light)', borderRadius: 'var(--radius-xs)',
                            fontSize: 15, fontWeight: 700, color: 'var(--amber)',
                            border: '1px solid var(--amber)',
                          }}>
                            {(() => { const net = (parseFloat(grossWeight) || 0) - (parseFloat(wasteWeight) || 0); return net > 0 ? Math.round(net) : '—' })()}
                          </div>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>g</span>
                        </div>
                      </div>
                    </div>
                    {!grossWeight && (
                      <div style={{ fontSize: 12, color: 'var(--text-hint)', fontStyle: 'italic' }}>Pèse d'abord l'aliment entier, puis reviens peser le déchet.</div>
                    )}
                    {grossWeight && !wasteWeight && (
                      <div style={{ fontSize: 12, color: 'var(--amber)', fontStyle: 'italic' }}>✓ Poids brut noté. Va peser le déchet, puis reviens ici.</div>
                    )}
                  </div>
                ) : (
                  /* Mode normal */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <input
                      className="input-sm"
                      type="text"
                      inputMode="decimal"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                )}

                {/* Macro preview */}
                <MacroPreview food={selected} qty={qty} />
              </>
            )}

            {/* Contexte (ex: repas ciblé — non modifiable, déjà choisi via le "+") */}
            {contextLabel && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {contextLabel}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={confirm}
              disabled={subtractMode && (
                !grossWeight || !wasteWeight ||
                (parseFloat(grossWeight) || 0) - (parseFloat(wasteWeight) || 0) <= 0
              )}
              style={{
                opacity: subtractMode && (
                  !grossWeight || !wasteWeight ||
                  (parseFloat(grossWeight) || 0) - (parseFloat(wasteWeight) || 0) <= 0
                ) ? 0.45 : 1
              }}
            >{confirmLabel}</button>
            <button className="btn-ghost" style={{ width: '100%', marginTop: 8, textAlign: 'center' }} onClick={onClose}>Annuler</button>
          </>
        )}
      </div>

      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleScanDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {adjustingRecipeQty && selected && (
        <RecipeQuantityAdjustModal
          recetteId={selected.id}
          recetteNom={selected.alim_nom}
          currentQtyG={parseFloat(qty) || 0}
          onApply={(newQtyG, newPer100) => {
            setQty(String(newQtyG))
            if (newPer100) setSelected(prev => ({ ...prev, ...newPer100 }))
          }}
          onClose={() => setAdjustingRecipeQty(false)}
        />
      )}
    </div>
  )
}