import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, ScanLine, Camera, ArrowLeft, Trash2, ChevronDown, Scale } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import BarcodeScanner from './BarcodeScanner'
import { useBackButton } from '../hooks/useBackButton'
import { saveRecette, sumIngredients, calcPer100g } from '../hooks/useRecipes'

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : prévisualisation macros d'un ingrédient
// ─────────────────────────────────────────────────────────────────────────────
function MacroPreview({ food, qty }) {
  const f = (parseFloat(qty) || 0) / 100
  const items = [
    { label: 'kcal', val: Math.round((food.energie_kcal || 0) * f),               color: 'var(--text)' },
    { label: 'Prot', val: `${((food.proteines || 0) * f).toFixed(1)}g`,           color: 'var(--green)' },
    { label: 'Gluc', val: `${((food.glucides  || 0) * f).toFixed(1)}g`,           color: 'var(--amber)' },
    { label: 'Lip',  val: `${((food.lipides   || 0) * f).toFixed(1)}g`,           color: 'var(--coral)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '7px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : ligne d'un résultat de recherche
// ─────────────────────────────────────────────────────────────────────────────
function FoodRow({ food, onSelect }) {
  return (
    <div
      onClick={() => onSelect(food)}
      style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 8 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{food.alim_nom}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {food.categorie}
          {food._source === 'custom' && <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Perso</span>}
          {food._source === 'off'    && <span style={{ marginLeft: 6, background: 'var(--blue-light)',   color: 'var(--blue)',   borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>OFF</span>}
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0 }}>{food.energie_kcal} kcal/100g</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : panneau de recherche d'un ingrédient
// ─────────────────────────────────────────────────────────────────────────────
function IngredientSearch({ user, onSelect, onClose }) {
  const toast = useToast()
  const [query,          setQuery]          = useState('')
  const [results,        setResults]        = useState([])
  const [searching,      setSearching]      = useState(false)
  const [selectedFood,   setSelectedFood]   = useState(null)
  const [qty,            setQty]            = useState('100')
  const [barcode,        setBarcode]        = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [scannerOpen,    setScannerOpen]    = useState(false)
  const timerRef = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)
    const { data, error } = await supabase.rpc('search_ciqual', { query: q, lim: 25 })
    if (error) console.error('search_ciqual error:', error)
    if (!data || data.length === 0) {
      const { data: custom } = await supabase.from('aliments_custom').select('*').eq('user_id', user.id).ilike('nom', `%${q}%`).limit(10)
      setResults((custom || []).map(c => ({ ...c, alim_nom: c.nom, categorie: c.categorie || 'Personnalisé', _source: 'custom' })))
    } else {
      const { data: custom } = await supabase.from('aliments_custom').select('*').eq('user_id', user.id).ilike('nom', `%${q}%`).limit(5)
      const customMapped = (custom || []).map(c => ({ ...c, alim_nom: c.nom, categorie: c.categorie || 'Personnalisé', _source: 'custom' }))
      setResults([...data, ...customMapped])
    }
    setSearching(false)
  }, [user])

  const handleQuery = (v) => {
    setQuery(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 250)
  }

  const fetchBarcode = async (codeOverride) => {
    const code = (codeOverride ?? barcode).trim()
    if (!code) return
    setBarcodeLoading(true)
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const n = p.nutriments || {}
        const food = {
          alim_nom:    p.product_name || 'Produit inconnu',
          categorie:   p.categories?.split(',')[0]?.trim() || 'Open Food Facts',
          energie_kcal: Math.round(n['energy-kcal_100g'] || (n['energy_100g'] || 0) / 4.184),
          proteines:   parseFloat((n['proteins_100g']       || 0).toFixed(1)),
          glucides:    parseFloat((n['carbohydrates_100g']  || 0).toFixed(1)),
          lipides:     parseFloat((n['fat_100g']            || 0).toFixed(1)),
          fibres:      parseFloat((n['fiber_100g']          || 0).toFixed(1)),
          sucres:      parseFloat((n['sugars_100g']         || 0).toFixed(1)),
          acides_gras_satures: parseFloat((n['saturated-fat_100g'] || 0).toFixed(2)),
          ag_monoinsatures:    parseFloat((n['monounsaturated-fat_100g'] || 0).toFixed(2)),
          ag_polyinsatures:    parseFloat((n['polyunsaturated-fat_100g'] || 0).toFixed(2)),
          cholesterol: parseFloat(((n['cholesterol_100g']   || 0) * 1000).toFixed(1)),
          sel:         parseFloat((n['salt_100g']           || 0).toFixed(2)),
          vit_c:       parseFloat(((n['vitamin-c_100g']     || 0) * 1000).toFixed(2)),
          vit_d:       parseFloat(((n['vitamin-d_100g']     || 0) * 1000000).toFixed(2)),
          calcium:     parseFloat(((n['calcium_100g']       || 0) * 1000).toFixed(1)),
          fer:         parseFloat(((n['iron_100g']          || 0) * 1000).toFixed(2)),
          magnesium:   parseFloat(((n['magnesium_100g']     || 0) * 1000).toFixed(1)),
          potassium:   parseFloat(((n['potassium_100g']     || 0) * 1000).toFixed(1)),
          zinc:        parseFloat(((n['zinc_100g']          || 0) * 1000).toFixed(2)),
          sodium:      parseFloat(((n['sodium_100g']        || 0) * 1000).toFixed(1)),
          portions: p.serving_size ? [{ label: 'Portion recommandée', g: parseFloat(p.serving_size) || 100 }] : [],
          _source: 'off',
        }
        setSelectedFood(food)
        setQty(String(food.portions?.[0]?.g || 100))
      } else {
        toast('Produit non trouvé dans Open Food Facts')
      }
    } catch { toast('Erreur réseau') }
    setBarcodeLoading(false)
  }

  const handleScanDetected = (code) => {
    setScannerOpen(false)
    setBarcode(code)
    fetchBarcode(code)
  }

  // ── Confirme l'ajout de l'ingrédient ──────────────────────────────────────
  const confirm = () => {
    if (!selectedFood) return
    const f = (parseFloat(qty) || 0) / 100
    const ing = {
      food_name:   selectedFood.alim_nom,
      food_source: selectedFood._source || 'ciqual',
      food_ref_id: selectedFood.alim_code || selectedFood.id || null,
      qty_g:       parseFloat(qty) || 0,
      energie_kcal: parseFloat(((selectedFood.energie_kcal || 0) * f).toFixed(1)),
      proteines:    parseFloat(((selectedFood.proteines    || 0) * f).toFixed(2)),
      glucides:     parseFloat(((selectedFood.glucides     || 0) * f).toFixed(2)),
      lipides:      parseFloat(((selectedFood.lipides      || 0) * f).toFixed(2)),
      fibres:       parseFloat(((selectedFood.fibres       || 0) * f).toFixed(2)),
      sel:          parseFloat(((selectedFood.sel          || 0) * f).toFixed(2)),
      sucres:       parseFloat(((selectedFood.sucres       || 0) * f).toFixed(2)),
      acides_gras_satures: parseFloat(((selectedFood.acides_gras_satures || 0) * f).toFixed(2)),
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = selectedFood[key]
      ing[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
    }
    onSelect(ing)
  }

  // ── Vue configure : portions + grammage ──────────────────────────────────
  if (selectedFood) {
    return (
      <>
        <div className="page-modal-header">
          <button className="btn-icon" onClick={() => setSelectedFood(null)}><ArrowLeft size={20} color="var(--text-muted)" /></button>
          <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFood.alim_nom}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        <div className="page-modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>{selectedFood.categorie}</div>

          {selectedFood.portions?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>Portions courantes</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedFood.portions.map((p, i) => (
                  <button key={i} className="chip" onClick={() => setQty(String(p.g))}>{p.label} · {p.g}g</button>
                ))}
                <button className="chip" onClick={() => setQty('100')}>100g</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <input className="input-sm" type="text" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
          </div>

          <MacroPreview food={selectedFood} qty={qty} />

          <button className="btn-primary" onClick={confirm}>Ajouter à la recette</button>
          <button className="btn-ghost" style={{ width: '100%', marginTop: 8, textAlign: 'center' }} onClick={onClose}>Annuler</button>
        </div>
      </>
    )
  }

  // ── Vue recherche ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ajouter un ingrédient</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
          <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input" style={{ paddingLeft: 36 }} placeholder="Poulet, riz, huile d'olive..."
            value={query} onChange={e => handleQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(query); e.currentTarget.blur() } }}
            enterKeyHint="search" inputMode="search"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <ScanLine size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="input" style={{ paddingLeft: 36 }} placeholder="Code-barres..." type="number"
              value={barcode} onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchBarcode(); e.currentTarget.blur() } }}
              enterKeyHint="go"
            />
          </div>
          <button onClick={() => setScannerOpen(true)} style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 9, padding: '0 12px', display: 'flex', alignItems: 'center' }} aria-label="Scanner">
            <Camera size={18} />
          </button>
          <button onClick={() => fetchBarcode()} disabled={barcodeLoading} style={{ background: 'var(--green)', color: 'white', borderRadius: 9, padding: '0 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', opacity: barcodeLoading ? 0.6 : 1 }}>
            {barcodeLoading ? '...' : 'OK'}
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {searching && <div className="loader"><div className="spinner" /> Recherche...</div>}
          {!searching && query.length >= 2 && results.length === 0 && <div className="empty">Aucun résultat pour « {query} »</div>}
          {!searching && query.length >= 2 && results.map((food, i) => (
            <FoodRow key={food.id || food.alim_code || i} food={food} onSelect={f => { setSelectedFood(f); setQty(String(f.portions?.[0]?.g || 100)) }} />
          ))}
          {!searching && query.length < 2 && <div className="empty">Tape au moins 2 caractères pour chercher</div>}
        </div>
      </div>

      {scannerOpen && <BarcodeScanner onDetected={handleScanDetected} onClose={() => setScannerOpen(false)} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal : RecipeFormModal
// Props :
//   recette      — objet recette existant (mode édition) ou null (création)
//   ingredients  — tableau d'ingrédients existants (mode édition) ou []
//   onSaved(id)  — callback appelé après sauvegarde réussie
//   onClose      — ferme la modal
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeFormModal({ recette, ingredients: initIngredients = [], onSaved, onClose }) {
  useBackButton(onClose)
  const toast  = useToast()
  const { user } = useAuth()

  const [nom,      setNom]      = useState(recette?.nom      || '')
  const [portions, setPortions] = useState(String(recette?.portions || 1))
  const [poidsCuitG, setPoidsCuitG] = useState(recette?.poids_cuit_g ? String(recette.poids_cuit_g) : '')
  const [tare,       setTare]       = useState('')
  const [totalBrut,  setTotalBrut]  = useState('')

  const [ingredients, setIngredients] = useState(initIngredients)
  const [showSearch,  setShowSearch]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [openWeighing, setOpenWeighing] = useState(false)
  const weighingRef = useRef(null)

  // Poids brut cru = somme des qty_g de tous les ingrédients (calculé auto)
  const poidsCruG = ingredients.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0)

  // Méthode tare : poids cuit net = total brut − tare
  const poidsCuitFromTare = parseFloat(tare) > 0 && parseFloat(totalBrut) > 0
    ? Math.max(0, parseFloat(totalBrut) - parseFloat(tare))
    : 0

  // Poids cuit effectif : méthode tare en priorité, sinon saisie directe
  const poidsCuitNet = poidsCuitFromTare > 0 ? poidsCuitFromTare : (parseFloat(poidsCuitG) || 0)

  // Totaux nutritionnels bruts (pour le plat entier)
  const totaux = sumIngredients(ingredients)

  // Référence de poids pour le calcul /100g :
  // si le poids cuit est renseigné → on l'utilise (méthode scientifique)
  // sinon → on utilise le poids cru
  const poidsRef = poidsCuitNet > 0 ? poidsCuitNet : poidsCruG
  const per100   = poidsRef > 0 ? calcPer100g(totaux, poidsRef) : null

  // ── Ajouter un ingrédient ─────────────────────────────────────────────────
  const handleIngredientSelected = (ing) => {
    setIngredients(prev => [...prev, { ...ing, _tmpId: Date.now() }])
    setShowSearch(false)
  }

  const removeIngredient = (idx) => setIngredients(prev => prev.filter((_, i) => i !== idx))

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const save = async () => {
    if (!nom.trim())        { toast('⚠ Donne un nom à ta recette') ; return }
    if (ingredients.length === 0) { toast('⚠ Ajoute au moins un ingrédient') ; return }
    setSaving(true)
    const { id, error } = await saveRecette({
      userId:          user.id,
      recetteId:       recette?.id || null,
      nom,
      portions:        parseInt(portions, 10) || 1,
      poidsCruG,
      poidsCuitG:      poidsCuitNet > 0 ? poidsCuitNet : null,
      poidsReferenceG: poidsRef,
      ingredients,
    })
    setSaving(false)
    if (!error) {
      toast(recette ? '✓ Recette modifiée !' : '✓ Recette sauvegardée !')
      onSaved(id)
    } else {
      toast('Erreur lors de la sauvegarde')
      console.error(error)
    }
  }

  // ── Rendu : vue "recherche d'ingrédient" ──────────────────────────────────
  if (showSearch) {
    return (
      <div className="page-modal">
        <IngredientSearch user={user} onSelect={handleIngredientSelected} onClose={() => setShowSearch(false)} />
      </div>
    )
  }

  // ── Rendu : formulaire principal ──────────────────────────────────────────
  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <h2>{recette ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
        <div style={{ width: 32 }} />
      </div>

      <div className="page-modal-body">

        {/* ── Nom + portions ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nom de la recette *</div>
            <input className="input" placeholder="Ex: Poulet rôti aux légumes" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nombre de portions</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input className="input-sm" type="number" min={1} value={portions} onChange={e => setPortions(e.target.value)} style={{ width: 70 }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>portion{parseInt(portions) > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* ── Liste des ingrédients ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Ingrédients ({ingredients.length})</div>
          <button
            onClick={() => setShowSearch(true)}
            style={{ background: 'var(--green)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}
          >
            + Ajouter
          </button>
        </div>

        {ingredients.length === 0 && (
          <div className="empty" style={{ padding: '24px 0' }}>Aucun ingrédient · appuie sur + Ajouter</div>
        )}

        {ingredients.map((ing, idx) => (
          <div key={ing.id || ing._tmpId || idx} className="card" style={{ marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {ing.qty_g}g&nbsp;·&nbsp;
                <span className="c-prot">P {(ing.proteines || 0).toFixed(1)}g</span>&nbsp;
                <span className="c-gluc">G {(ing.glucides  || 0).toFixed(1)}g</span>&nbsp;
                <span className="c-lip">L {(ing.lipides   || 0).toFixed(1)}g</span>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(ing.energie_kcal || 0)} kcal</span>
            <button className="btn-icon" onClick={() => removeIngredient(idx)} style={{ color: 'var(--text-hint)' }}><Trash2 size={15} /></button>
          </div>
        ))}

        {/* ── Section pesée ── */}
        {ingredients.length > 0 && (
          <div ref={weighingRef} className="card" style={{ marginBottom: 12 }}>
            <button
              onClick={() => {
                setOpenWeighing(o => {
                  const next = !o
                  if (next) setTimeout(() => weighingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                  return next
                })
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={16} color="var(--green)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Peser le plat après cuisson</span>
              </div>
              <ChevronDown size={18} color="var(--text-muted)" style={{ transform: openWeighing ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>

            {openWeighing && (
              <div style={{ padding: '0 16px 16px' }}>
                {/* Poids cru calculé */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '10px 12px', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Poids cru total</div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>Somme de tous les ingrédients</div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{Math.round(poidsCruG)} g</span>
                </div>

                {/* ── Méthode tare (recommandée) ── */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-hint)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
                  ⚖️ Méthode recommandée — avec tare
                </div>

                {/* ① Tare */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    ① Poids du récipient <strong>vide</strong> (tare)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—" value={tare} onChange={e => setTare(e.target.value)}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                </div>

                {/* ② Poids total brut */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    ② Poids total après cuisson <strong>(récipient + nourriture)</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—" value={totalBrut} onChange={e => setTotalBrut(e.target.value)}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                </div>

                {/* Résultat tare */}
                {poidsCuitFromTare > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--green-light)', borderRadius: 8, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)' }}>✓ Poids cuit net</div>
                      <div style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 2 }}>{totalBrut} − {tare} g</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{Math.round(poidsCuitFromTare)} g</span>
                  </div>
                )}

                {/* Séparateur */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>ou saisie directe</span>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                </div>

                {/* Poids cuit direct (désactivé si méthode tare active) */}
                <div style={{ marginBottom: 10, opacity: poidsCuitFromTare > 0 ? 0.45 : 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    Poids cuit net {poidsCuitFromTare > 0 ? <span style={{ color: 'var(--text-hint)' }}>(remplacé par la méthode tare)</span> : <strong>direct</strong>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      className="input-sm" type="text" inputMode="decimal"
                      placeholder="—"
                      value={poidsCuitFromTare > 0 ? Math.round(poidsCuitFromTare) : poidsCuitG}
                      onChange={poidsCuitFromTare > 0 ? undefined : e => setPoidsCuitG(e.target.value)}
                      readOnly={poidsCuitFromTare > 0}
                      style={{ width: 90 }}
                    />
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                  </div>
                </div>

                {/* Explication méthode */}
                <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.5, background: 'var(--blue-light)', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
                  💡 <strong>Méthode :</strong> pèse le récipient vide (tare), cuisine, puis pèse le tout. La différence = poids cuit net. Les kcal totales restent calculées sur les ingrédients crus.
                </div>

                {/* Référence utilisée */}
                {poidsRef > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                    Référence utilisée : <strong style={{ color: 'var(--text)' }}>{Math.round(poidsRef)} g</strong>
                    {poidsCuitNet > 0 ? ' (poids cuit ✓)' : ' (poids cru — renseigne le poids cuit pour plus de précision)'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Récap nutritionnel /100g ── */}
        {per100 && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="section-title">Valeurs pour 100 g de plat {poidsCuitNet > 0 ? 'cuit' : 'cru'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'kcal',   val: Math.round(per100.energie_kcal || 0), color: 'var(--text)'  },
                { label: 'Prot.',  val: `${(per100.proteines || 0).toFixed(1)}g`, color: 'var(--green)' },
                { label: 'Gluc.',  val: `${(per100.glucides  || 0).toFixed(1)}g`, color: 'var(--amber)' },
                { label: 'Lip.',   val: `${(per100.lipides   || 0).toFixed(1)}g`, color: 'var(--coral)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {parseInt(portions) > 0 && poidsRef > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                → <strong style={{ color: 'var(--text)' }}>{Math.round(per100.energie_kcal * poidsRef / 100 / parseInt(portions))} kcal</strong> par portion ({Math.round(poidsRef / parseInt(portions))} g)
              </div>
            )}
          </div>
        )}

        {/* ── Bouton sauvegarder ── */}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : recette ? '💾 Enregistrer les modifications' : '💾 Sauvegarder la recette'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10, marginBottom: 8 }}>
          La recette sera disponible dans la recherche pour l'ajouter au journal
        </div>
      </div>
    </div>
  )
}