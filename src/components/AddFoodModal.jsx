import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

const MEALS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']

function MacroPreview({ food, qty }) {
  const f = qty / 100
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

export default function AddFoodModal({ initialMeal, onAdd, onClose }) {
  const toast = useToast()
  const [step, setStep] = useState('search') // search | configure
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(100)
  const [meal, setMeal] = useState(initialMeal || 'Déjeuner')
  const [barcode, setBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const searchRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase.rpc('search_ciqual', { query: q, lim: 25 })
    if (!data || data.length === 0) {
      // fallback: also check custom foods
      const { data: custom } = await supabase.from('aliments_custom').select('*').ilike('nom', `%${q}%`).limit(10)
      setResults((custom || []).map(c => ({
        ...c, alim_nom: c.nom, categorie: c.categorie || 'Personnalisé',
        energie_kcal: c.energie_kcal, proteines: c.proteines, glucides: c.glucides,
        lipides: c.lipides, fibres: c.fibres, portions: c.portions,
        _source: 'custom'
      })))
    } else {
      // merge with custom
      const { data: custom } = await supabase.from('aliments_custom').select('*').ilike('nom', `%${q}%`).limit(5)
      const customMapped = (custom || []).map(c => ({
        ...c, alim_nom: c.nom, categorie: c.categorie || 'Personnalisé', _source: 'custom'
      }))
      setResults([...data, ...customMapped])
    }
    setSearching(false)
  }, [])

  const handleQuery = (v) => {
    setQuery(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 250)
  }

  const fetchBarcode = async () => {
    if (!barcode.trim()) return
    setBarcodeLoading(true)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`)
      const data = await res.json()
      if (data.status === 1 && data.product) {
        const p = data.product
        const n = p.nutriments || {}
        const food = {
          alim_nom: p.product_name || 'Produit inconnu',
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
          portions: p.serving_size ? [{ label: 'Portion recommandée', g: parseFloat(p.serving_size) || 100 }] : [],
          _source: 'off'
        }
        selectFood(food)
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
    setQty(defaultPortion)
    setStep('configure')
  }

  const confirm = async () => {
    if (!selected) return
    const f = qty / 100
    const entry = {
      meal,
      food_name: selected.alim_nom,
      food_source: selected._source || 'ciqual',
      food_ref_id: selected.alim_code || selected.id || null,
      qty_g: qty,
      energie_kcal: parseFloat(((selected.energie_kcal || 0) * f).toFixed(1)),
      proteines: parseFloat(((selected.proteines || 0) * f).toFixed(2)),
      glucides: parseFloat(((selected.glucides || 0) * f).toFixed(2)),
      lipides: parseFloat(((selected.lipides || 0) * f).toFixed(2)),
      fibres: parseFloat(((selected.fibres || 0) * f).toFixed(2)),
      vit_c: parseFloat(((selected.vit_c || 0) * f).toFixed(3)),
      vit_d: parseFloat(((selected.vit_d || 0) * f).toFixed(4)),
      calcium: parseFloat(((selected.calcium || 0) * f).toFixed(2)),
      fer: parseFloat(((selected.fer || 0) * f).toFixed(3)),
      magnesium: parseFloat(((selected.magnesium || 0) * f).toFixed(2)),
      potassium: parseFloat(((selected.potassium || 0) * f).toFixed(2)),
      vit_b12: parseFloat(((selected.vit_b12 || 0) * f).toFixed(4)),
      vit_a: parseFloat(((selected.vit_a || 0) * f).toFixed(3)),
      vit_e: parseFloat(((selected.vit_e || 0) * f).toFixed(3)),
    }
    await onAdd(entry)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        {step === 'search' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ajouter un aliment</h2>
              <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
            </div>

            {/* Search input */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={searchRef}
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Poulet, riz, pomme..."
                value={query}
                onChange={e => handleQuery(e.target.value)}
              />
            </div>

            {/* Barcode row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <ScanLine size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Code-barres..."
                  type="number"
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchBarcode()}
                />
              </div>
              <button
                onClick={fetchBarcode}
                disabled={barcodeLoading}
                style={{ background: 'var(--green)', color: 'white', borderRadius: 9, padding: '0 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', flexShrink: 0, opacity: barcodeLoading ? 0.6 : 1 }}
              >
                {barcodeLoading ? '...' : 'Scan'}
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {searching && <div className="loader"><div className="spinner" /> Recherche...</div>}
              {!searching && results.length === 0 && query.length >= 2 && (
                <div className="empty">Aucun résultat pour « {query} »</div>
              )}
              {!searching && results.length === 0 && query.length < 2 && (
                <div className="empty">Tape au moins 2 caractères</div>
              )}
              {results.map((food, i) => (
                <div
                  key={food.id || food.alim_code || i}
                  onClick={() => selectFood(food)}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.alim_nom}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {food.categorie}
                      {food._source === 'custom' && <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Perso</span>}
                      {food._source === 'off' && <span style={{ marginLeft: 6, background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>OFF</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0 }}>{food.energie_kcal} kcal/100g</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'configure' && selected && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button className="btn-icon" onClick={() => setStep('search')} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>←</button>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{selected.alim_nom}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.categorie}</div>
              </div>
            </div>

            {/* Portions chips */}
            {selected.portions?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 6 }}>Portions courantes</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.portions.map((p, i) => (
                    <button key={i} className="chip" onClick={() => setQty(p.g)}>
                      {p.label} · {p.g}g
                    </button>
                  ))}
                  <button className="chip" onClick={() => setQty(100)}>100g</button>
                </div>
              </div>
            )}

            {/* Qty input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <input
                className="input-sm"
                type="number"
                value={qty}
                min={1}
                onChange={e => setQty(parseFloat(e.target.value) || 0)}
              />
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
            </div>

            {/* Macro preview */}
            <MacroPreview food={selected} qty={qty} />

            {/* Meal select */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Repas</div>
              <select className="input" value={meal} onChange={e => setMeal(e.target.value)}>
                {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <button className="btn-primary" onClick={confirm}>Ajouter au journal</button>
            <button className="btn-ghost" style={{ width: '100%', marginTop: 8, textAlign: 'center' }} onClick={onClose}>Annuler</button>
          </>
        )}
      </div>
    </div>
  )
}
