import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, ScanLine, Camera, ArrowLeft, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useFavoris, foodIdentity } from '../hooks/useFavoris'
import { useRecentFoods } from '../hooks/useRecentFoods'
import BarcodeScanner from './BarcodeScanner'
import { useBackButton } from '../hooks/useBackButton'

function MacroPreview({ food, qty }) {
  const f = (parseFloat(qty) || 0) / 100
  const items = [
    { label: 'kcal', val: Math.round((food.energie_kcal || 0) * f), color: 'var(--text)' },
    { label: 'Prot.', val: `${((food.proteines || 0) * f).toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.', val: `${((food.glucides || 0) * f).toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',  val: `${((food.lipides || 0) * f).toFixed(1)}g`,  color: 'var(--coral)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 16 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

function FoodRow({ food, isFav, onSelect, onToggleFav }) {
  return (
    <div
      onClick={() => onSelect(food)}
      style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 8 }}
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
          {food.categorie}
          {food._source === 'custom' && <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Perso</span>}
          {food._source === 'off' && <span style={{ marginLeft: 6, background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>OFF</span>}
          {food._source === 'recette' && <span style={{ marginLeft: 6, background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Mes recettes</span>}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0 }}>{food.energie_kcal} kcal/100g</span>
    </div>
  )
}

export default function AddFoodModal({ initialMeal, onAdd, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const { user } = useAuth()
  const { favoris, isFavorite, toggleFavorite } = useFavoris()
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
  const meal = initialMeal || 'Déjeuner' // fixé par le "+" sur lequel on a cliqué
  const [barcode, setBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [searchSource, setSearchSource] = useState('ciqual') // 'ciqual' | 'off'
  const searchRef = useRef(null)
  const timerRef = useRef(null)

  const favKeys = new Set(favoris.map(f => `${f.food_source}:${f.food_ref_id ?? f.food_name}`))
  const recentsFiltered = recents.filter(r => !favKeys.has(foodIdentity(r).key))

  // Pas d'autofocus à l'ouverture — évite l'ouverture automatique du clavier sur mobile.
  // Le focus est déclenché uniquement quand l'utilisateur revient à l'étape search
  // depuis l'étape configure (retour arrière).
  useEffect(() => {
    if (step !== 'search') return
    // On ne focus que si on revient depuis configure (selected existe déjà)
    if (!selected) return
    const t = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [step])

// ─── Remplacer la fonction doSearch dans AddFoodModal.jsx ───────────────────
//
// AVANT (ligne ~95) :
//   const doSearch = useCallback(async (q) => { ... }, [user])
//
// APRÈS : coller ce bloc à la place

  const mapOFFProduct = (p) => {
    const n = p.nutriments || {}
    return {
      alim_nom: p.product_name || p.product_name_fr || 'Produit inconnu',
      categorie: p.categories?.split(',')[0]?.trim() || 'Open Food Facts',
      energie_kcal: Math.round(n['energy-kcal_100g'] || (n['energy_100g'] || 0) / 4.184),
      proteines: parseFloat((n['proteins_100g'] || 0).toFixed(1)),
      glucides: parseFloat((n['carbohydrates_100g'] || 0).toFixed(1)),
      lipides: parseFloat((n['fat_100g'] || 0).toFixed(1)),
      fibres: parseFloat((n['fiber_100g'] || 0).toFixed(1)),
      vit_c: parseFloat(((n['vitamin-c_100g'] || 0) * 1000).toFixed(2)),
      vit_d: parseFloat(((n['vitamin-d_100g'] || 0) * 1000000).toFixed(2)),
      calcium: parseFloat(((n['calcium_100g'] || 0) * 1000).toFixed(1)),
      fer: parseFloat(((n['iron_100g'] || 0) * 1000).toFixed(2)),
      sucres: parseFloat((n['sugars_100g'] || 0).toFixed(1)),
      acides_gras_satures: parseFloat((n['saturated-fat_100g'] || 0).toFixed(2)),
      ag_monoinsatures: parseFloat((n['monounsaturated-fat_100g'] || 0).toFixed(2)),
      ag_polyinsatures: parseFloat((n['polyunsaturated-fat_100g'] || 0).toFixed(2)),
      cholesterol: parseFloat(((n['cholesterol_100g'] || 0) * 1000).toFixed(1)),
      sel: parseFloat((n['salt_100g'] || 0).toFixed(2)),
      magnesium: parseFloat(((n['magnesium_100g'] || 0) * 1000).toFixed(1)),
      potassium: parseFloat(((n['potassium_100g'] || 0) * 1000).toFixed(1)),
      zinc: parseFloat(((n['zinc_100g'] || 0) * 1000).toFixed(2)),
      sodium: parseFloat(((n['sodium_100g'] || 0) * 1000).toFixed(1)),
      cuivre: parseFloat(((n['copper_100g'] || 0) * 1000).toFixed(2)),
      iode: parseFloat(((n['iodine_100g'] || 0) * 1000000).toFixed(1)),
      manganese: parseFloat(((n['manganese_100g'] || 0) * 1000).toFixed(2)),
      phosphore: parseFloat(((n['phosphorus_100g'] || 0) * 1000).toFixed(1)),
      selenium: parseFloat(((n['selenium_100g'] || 0) * 1000000).toFixed(1)),
      vit_b1: parseFloat(((n['vitamin-b1_100g'] || 0) * 1000).toFixed(3)),
      vit_b2: parseFloat(((n['vitamin-b2_100g'] || 0) * 1000).toFixed(3)),
      vit_b3: parseFloat(((n['vitamin-pp_100g'] || 0) * 1000).toFixed(2)),
      vit_b5: parseFloat(((n['pantothenic-acid_100g'] || 0) * 1000).toFixed(2)),
      vit_b6: parseFloat(((n['vitamin-b6_100g'] || 0) * 1000).toFixed(3)),
      vit_b12: parseFloat(((n['vitamin-b12_100g'] || 0) * 1000000).toFixed(3)),
      vit_a: parseFloat(((n['vitamin-a_100g'] || 0) * 1000000).toFixed(2)),
      vit_e: parseFloat(((n['vitamin-e_100g'] || 0) * 1000).toFixed(2)),
      vit_e_totale: parseFloat(((n['vitamin-e_100g'] || 0) * 1000).toFixed(2)),
      vit_k1: parseFloat(((n['vitamin-k_100g'] || 0) * 1000000).toFixed(2)),
      folates: parseFloat(((n['folates_100g'] || 0) * 1000000).toFixed(1)),
      portions: p.serving_size ? [{ label: 'Portion recommandée', g: parseFloat(p.serving_size) || 100 }] : [],
      _source: 'off',
    }
  }

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)

    if (searchSource === 'off') {
      try {
        const res = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,product_name_fr,categories,nutriments,serving_size`
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

    // Ciqual + aliments custom (comportement existant)
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

    const { data: recettes } = await supabase
      .from('recettes')
      .select('*')
      .eq('user_id', user.id)
      .ilike('nom', `%${q}%`)
      .limit(5)
    const recettesMapped = (recettes || []).map(r => ({
  ...r,                          // ← spread complet pour capturer tous les nutriments
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

    const ciqualResults = data || []
    setResults([...ciqualResults, ...customMapped, ...recettesMapped])
    setSearching(false)
  }, [user, searchSource])


// ─── Dans FoodRow, ajouter le badge recette après les badges custom/off ──────
//
// AVANT :
//   {food._source === 'off' && <span ...>OFF</span>}
//
// APRÈS : ajouter cette ligne juste en dessous
//
//   {food._source === 'recette' && (
//     <span style={{ marginLeft: 6, background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
//       Recette
//     </span>
//   )}

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

  const selectFood = (food) => {
    setSelected(food)
    const defaultPortion = food.portions?.[0]?.g || 100
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
    const f = (parseFloat(qty) || 0) / 100
    const entry = {
      meal,
      food_name: selected.alim_nom,
      food_source: selected._source || 'ciqual',
      food_ref_id: selected.alim_code || selected.id || null,
      qty_g: parseFloat(qty) || 0,
      energie_kcal: parseFloat(((selected.energie_kcal || 0) * f).toFixed(1)),
      proteines: parseFloat(((selected.proteines || 0) * f).toFixed(2)),
      glucides: parseFloat(((selected.glucides || 0) * f).toFixed(2)),
      lipides: parseFloat(((selected.lipides || 0) * f).toFixed(2)),
      fibres: parseFloat(((selected.fibres || 0) * f).toFixed(2)),
    }
    // Tous les autres nutriments (sucres détaillés, acides gras détaillés,
    // vitamines, minéraux...) sont scalés génériquement au prorata du
    // grammage — évite de lister ~50 champs à la main à chaque ajout.
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = selected[key]
      entry[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
    }
    await onAdd(entry)
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
        <h2>{step === 'search' ? 'Ajouter un aliment' : selected?.alim_nom}</h2>
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
                  {searchSource === 'ciqual' && favoris.length > 0 && (
                    <>
                      <div className="section-title" style={{ marginTop: 4 }}>★ Favoris</div>
                      {favoris.map(f => (
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

                  {searchSource === 'ciqual' && recentsFiltered.length > 0 && (
                    <>
                      <div className="section-title" style={{ marginTop: favoris.length > 0 ? 16 : 4 }}>Récents (3 derniers jours)</div>
                      {recentsFiltered.map((food, i) => (
                        <FoodRow
                          key={i}
                          food={food}
                          isFav={false}
                          onSelect={selectFood}
                          onToggleFav={toggleFavorite}
                        />
                      ))}
                    </>
                  )}

                  {(searchSource === 'off' || (favoris.length === 0 && recentsFiltered.length === 0)) && (
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

            {/* Repas ciblé (non modifiable — déjà choisi via le bouton "+") */}
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Ajout à : <strong style={{ color: 'var(--text)' }}>{meal}</strong>
            </div>

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
            >Ajouter au journal</button>
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