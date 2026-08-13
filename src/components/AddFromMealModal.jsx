import React, { useState, useEffect, useMemo } from 'react'
import { X, Search, Check, ArrowLeft, Minus, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useBackButton } from '../hooks/useBackButton'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// AddFromMealModal
// Même principe que AddFromRecipeModal, mais la source est un "repas type"
// (table repas_types) plutôt qu'une recette.
// Étape 1 : choisir un repas type (recherche par nom)
// Étape 2 : ajuster le nombre de portions souhaité (met à l'échelle les
//           grammages des aliments du repas), puis cocher/décocher les
//           aliments à ajouter à la liste
//
// Props :
//   onAdd(repas, itemsSélectionnésEtMisÀLÉchelle) — appelé à la validation
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function AddFromMealModal({ onAdd, onClose }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedRepas, setSelectedRepas] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!user) { setRepasList([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('repas_types')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (active) { setRepasList(data || []); setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [user])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return repasList
    return repasList.filter(r => (r.nom || '').toLowerCase().includes(q))
  }, [repasList, query])

  if (selectedRepas) {
    return (
      <MealItemPicker
        repas={selectedRepas}
        onBack={() => setSelectedRepas(null)}
        onAdd={onAdd}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ajouter depuis un repas type</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            placeholder="Rechercher un repas type..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {loading && <Loader />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            title="Aucun repas type"
            description={repasList.length === 0 ? 'Crée d\'abord un repas type dans "Mes aliments"' : null}
          />
        )}

        {filtered.map(r => {
          const items = r.items || []
          const totalKcal = items.reduce((s, i) => s + (i.energie_kcal || 0), 0)
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRepas(r)}
              className="card"
              style={{ width: '100%', marginBottom: 8, padding: '12px 14px', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {items.length} aliment{items.length > 1 ? 's' : ''}{totalKcal ? ` · ${Math.round(totalKcal)} kcal` : ''}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PortionsStepper
// ─────────────────────────────────────────────────────────────────────────────
function PortionsStepper({ value, onChange, min = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', borderRadius: 20, padding: 3 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: value <= min ? 'var(--text-hint)' : 'var(--text)',
          border: 'none', opacity: value <= min ? 0.5 : 1,
        }}
      >
        <Minus size={13} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: 'var(--text)', border: 'none',
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MealItemPicker — étape 2
// Les aliments d'un repas type sont déjà stockés dans repas.items (pas de
// fetch à faire, contrairement aux ingrédients de recette). On s'en sert
// directement, avec un indice comme identifiant de sélection.
// ─────────────────────────────────────────────────────────────────────────────
function MealItemPicker({ repas, onBack, onAdd, onClose }) {
  const items = repas.items || []
  const nbPortionsBase = parseInt(repas.nb_portions, 10) || 1
  const [portionsSouhaitees, setPortionsSouhaitees] = useState(nbPortionsBase)
  // null = "tous sélectionnés" (état par défaut avant toute interaction)
  const [selectedIndexes, setSelectedIndexes] = useState(null)
  const [adding, setAdding] = useState(false)

  const factor = nbPortionsBase > 0 ? portionsSouhaitees / nbPortionsBase : 1
  const scaled = factor !== 1

  const scaledItems = useMemo(
    () => items.map((it, i) => ({ ...it, _idx: i, qty_g: it.qty_g != null ? Math.round(it.qty_g * factor * 10) / 10 : it.qty_g })),
    [items, factor]
  )

  const isSelected = (idx) => selectedIndexes === null || selectedIndexes.includes(idx)

  const toggle = (idx) => {
    setSelectedIndexes(prev => {
      const base = prev === null ? items.map((_, i) => i) : prev
      return base.includes(idx) ? base.filter(x => x !== idx) : [...base, idx]
    })
  }

  const selectedCount = selectedIndexes === null ? scaledItems.length : selectedIndexes.length

  const confirm = async () => {
    if (selectedCount === 0) return
    setAdding(true)
    const toAdd = selectedIndexes === null ? scaledItems : scaledItems.filter(it => selectedIndexes.includes(it._idx))
    await onAdd(repas, toAdd)
    setAdding(false)
    onClose()
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onBack} style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></button>
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repas.nom}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {nbPortionsBase > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Portions :</span>
            <PortionsStepper value={portionsSouhaitees} onChange={setPortionsSouhaitees} />
          </div>
        )}
        {scaled && (
          <div style={{ fontSize: 12, color: 'var(--green-dark)', marginBottom: 10 }}>
            × {factor.toFixed(2).replace(/\.?0+$/, '')} — repas de base pour {nbPortionsBase} portion{nbPortionsBase > 1 ? 's' : ''}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, marginTop: scaled ? 0 : 6 }}>
          Décoche les aliments que tu as déjà, ou que tu ne veux pas acheter.
        </div>

        {scaledItems.map(it => {
          const sel = isSelected(it._idx)
          return (
            <button
              key={it._idx}
              onClick={() => toggle(it._idx)}
              className="card"
              style={{ width: '100%', marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${sel ? 'var(--green)' : 'var(--border-md)'}`,
                background: sel ? 'var(--green)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}>
                {sel && <Check size={13} color="white" strokeWidth={3} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, opacity: sel ? 1 : 0.5 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.food_name}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, opacity: sel ? 1 : 0.5 }}>{it.qty_g} g</span>
            </button>
          )
        })}

        <button
          className="btn-primary"
          onClick={confirm}
          disabled={adding || selectedCount === 0}
          style={{ opacity: adding || selectedCount === 0 ? 0.5 : 1, marginTop: 8 }}
        >
          {adding ? 'Ajout...' : `Ajouter ${selectedCount} aliment${selectedCount > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
