import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Search, ScanLine, Camera, ArrowLeft, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { useFavorites, foodIdentity } from '../hooks/useFavorites'
import { useRecentFoods } from '../hooks/useRecentFoods'
import BarcodeScanner from './BarcodeScanner'
import { useBackButton } from '../hooks/useBackButton'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { mapOFFProduct } from '../lib/openFoodFacts'
import MacroPreview from './MacroPreview'
import FoodRow from './FoodRow'
import FavSortToggle from './FavSortToggle'

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
  const [subtractMode, setSubtractMode] = useState(false)
  const [grossWeight, setGrossWeight] = useState("")
  const [wasteWeight, setWasteWeight] = useState("")
  const [barcode, setBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [searchSource, setSearchSource] = useState('ciqual') // 'ciqual' | 'off'
  const [favoritesCollapsed, setFavoritesCollapsed] = useState(false)
  const [favSort, setFavSort] = useState('recent') // 'recent' | 'alpha' | 'most'
  const searchRef = useRef(null)
  const timerRef = useRef(null)

  // Un aliment favori reste affiché dans les récents (l'utilisateur veut voir
  // les deux). Quand un récent correspond à un favori, on fusionne les portions
  // recommandées du favori (stockées dans food_data) avec la "Dernière quantité"
  // venant du journal, sans que l'une efface l'autre.
  const favoriteByKey = new Map(favorites.map(f => [`${f.food_source}:${f.food_ref_id ?? f.food_name}`, f]))

  // "Récents" = dernière utilisation réelle (last_used_at, alimenté par
  // bumpFavoriteUsage à chaque ajout au journal) ; un favori jamais utilisé
  // retombe sur sa date d'ajout aux favoris (created_at).
  const sortedFavorites = useMemo(() => {
    const arr = [...favorites]
    if (favSort === 'alpha') {
      arr.sort((a, b) => (a.food_name || '').localeCompare(b.food_name || '', 'fr'))
    } else if (favSort === 'most') {
      arr.sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
    } else {
      arr.sort((a, b) => new Date(b.last_used_at || b.created_at) - new Date(a.last_used_at || a.created_at))
    }
    return arr
  }, [favorites, favSort])
  const recentsMerged = recents.map(r => {
    const fav = favoriteByKey.get(foodIdentity(r).key)
    if (!fav) return r
    const recommandees = (fav.food_data.portions || []).filter(
      p => !r.portions.some(rp => rp.g === p.g)
    )
    return { ...r, portions: [...recommandees, ...r.portions] }
  })

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
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,product_name_fr,categories,brands,nutriments,serving_size`
        )
        const data = await res.json()
        const products = (data.products || [])
          .filter(p => p.product_name || p.product_name_fr)
          .map(mapOFFProduct)
        setResults(products)
      } catch {
        toast('Erreur réseau Open Food Facts')
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
    if (query.length >= 2) doSearch(query)
  }, [searchSource])

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
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        selectFood(mapOFFProduct(data.product))
      } else {
        toast('Produit non trouvé dans Open Food Facts')
      }
    } catch {
      toast('Erreur réseau')
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

  setSelected(enriched)
  const defaultPortion = enriched.portions?.[0]?.g || 100
  setQty(String(defaultPortion))
  setSubtractMode(false)
  setGrossWeight("")
  setWasteWeight("")
  setStep('configure')
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
              {searching && <div className="loader"><div className="spinner" /> Recherche...</div>}

              {!searching && query.length >= 2 && results.length === 0 && (
                <div className="empty">
                  {searchSource === 'off'
                    ? `Aucun résultat dans Open Food Facts pour « ${query} »`
                    : `Aucun résultat pour « ${query} »`}
                </div>
              )}

              {!searching && query.length >= 2 && results.map((food, i) => (
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
                          <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                            {favoritesCollapsed ? '▸' : '▾'}
                          </span>
                        </button>
                        {!favoritesCollapsed && favorites.length > 1 && (
                          <FavSortToggle value={favSort} onChange={setFavSort} />
                        )}
                      </div>
                      {!favoritesCollapsed && sortedFavorites.map(f => (
                        <FoodRow
                          key={f.id}
                          food={f.food_data}
                          isFav={true}
                          onSelect={selectFood}
                          onToggleFav={() => toggleFavorite(f.food_data)}
                        />
                      ))}
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
                    <div className="empty">
                      {searchSource === 'off'
                        ? 'Tape le nom d\'un produit emballé (marque, référence…)'
                        : 'Tape au moins 2 caractères'}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {step === 'configure' && selected && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{selected.categorie}</div>

            {/* Portions chips */}
            {selected.portions?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>Portions courantes</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.portions.map((p, i) => (
                    <button key={i} className="chip" onClick={() => setQty(String(p.g))}>
                      {p.label} · {p.g}g
                    </button>
                  ))}
                  <button className="chip" onClick={() => setQty('100')}>100g</button>
                </div>
              </div>
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
    </div>
  )
}