import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, CalendarDays, ArrowLeft } from 'lucide-react'
import { useToast } from '../lib/toast'
import { ALL_NUTRIENT_KEYS, MEALS_ORDER as MEALS } from '../lib/nutrients'
import AddFoodModal from './AddFoodModal'
import { useJournal } from '../hooks/useJournal'
import { useBackButton } from '../hooks/useBackButton'
import { todayStr } from '../lib/dates'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'
import { getRecipeCategoryIcon } from '../lib/categoryIcons'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// Extrait de MealTemplatesSection.jsx, pour être réutilisable comme "page dédiée"
// d'un repas type depuis n'importe où dans l'app (ex: cliquer sur un repas
// type planifié depuis le calendrier), pas seulement depuis l'onglet "repas"
// de ManualPage.
// ─────────────────────────────────────────────────────────────────────────────

function ImportFromDayModal({ onImport, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const today = todayStr()
  const yesterdayStr = todayStr(-1)

  const [date, setDate] = useState(today)
  const [selectedMeal, setSelectedMeal] = useState(MEALS[0])
  const { entries, loading } = useJournal(date)
  const [checked, setChecked] = useState({})

  const mealEntries = entries.filter(e => e.meal === selectedMeal)

  useEffect(() => {
    const next = {}
    for (const e of mealEntries) next[e.id] = true
    setChecked(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedMeal, entries])

  const toggle = (id) => setChecked(c => ({ ...c, [id]: !c[id] }))
  const toggleAll = () => {
    const allChecked = mealEntries.every(e => checked[e.id])
    const next = {}
    for (const e of mealEntries) next[e.id] = !allChecked
    setChecked(next)
  }

  const selectedEntries = mealEntries.filter(e => checked[e.id])

  const handleImport = () => {
    if (selectedEntries.length === 0) { toast('Coche au moins un aliment'); return }
    const items = selectedEntries.map(({ id, date: _d, meal: _m, user_id, created_at, ...rest }) => rest)
    onImport(items)
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Importer un repas</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body">
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le jour
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setDate(yesterdayStr)}
            className="chip"
            style={date === yesterdayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Hier
          </button>
          <button
            onClick={() => setDate(today)}
            className="chip"
            style={date === today ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Aujourd'hui
          </button>
          <input
            type="date"
            className="input"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le repas
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {MEALS.map(m => {
            const active = selectedMeal === m
            return (
              <button
                key={m}
                onClick={() => setSelectedMeal(m)}
                style={{
                  flex: '1 1 auto',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--green)' : 'var(--gray-bg)',
                  color: active ? 'white' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'var(--font)',
                  transition: 'all .15s',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>

        {loading && <Loader />}

        {!loading && mealEntries.length === 0 && (
          <EmptyState style={{ padding: '20px 10px' }}>
            Aucun aliment enregistré pour « {selectedMeal} » à cette date
          </EmptyState>
        )}

        {!loading && mealEntries.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                {mealEntries.length} aliment{mealEntries.length > 1 ? 's' : ''}
              </div>
              <button onClick={toggleAll} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', fontFamily: 'var(--font)' }}>
                {mealEntries.every(e => checked[e.id]) ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>

            {mealEntries.map(e => {
              const isChecked = !!checked[e.id]
              return (
                <div
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 2px', borderBottom: '0.5px solid var(--border)', gap: 10, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `1.5px solid ${isChecked ? 'var(--green)' : 'var(--border-md)'}`,
                    background: isChecked ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .12s',
                  }}>
                    {isChecked && <Check size={13} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.food_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.qty_g}g</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{Math.round(e.energie_kcal || 0)} kcal</span>
                </div>
              )
            })}
          </>
        )}

        <button
          className="btn-primary"
          onClick={handleImport}
          disabled={selectedEntries.length === 0}
          style={{ marginTop: 16, opacity: selectedEntries.length === 0 ? 0.5 : 1 }}
        >
          Ajouter {selectedEntries.length > 0 ? `${selectedEntries.length} aliment${selectedEntries.length > 1 ? 's' : ''}` : ''} à la liste
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

// ─── Édition d'un repas type — plein écran (même pattern que AddFoodModal) ──
// Props :
//   repas   — repas type existant (avec .id) en édition, ou null pour un nouveau
//   onSave({ nom, description, items, nb_portions, categories })
//   onClose()
export default function EditMealTemplatePage({ repas, onSave, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const [nom, setNom] = useState(repas?.nom || '')
  const [desc, setDesc] = useState(repas?.description || '')
  const [portions, setPortions] = useState(repas?.nb_portions || 1)
  const [items, setItems] = useState(repas?.items || [])
  const [categories, setCategories] = useState(repas?.categories || [])
  const [showAddFood, setShowAddFood] = useState(false)
  const [showImportMeal, setShowImportMeal] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const handleAddFood = (entry) => {
    setItems(prev => [...prev, { ...entry, meal: undefined }])
    setShowAddFood(false)
  }

  const handleImportMeal = (importedItems) => {
    setItems(prev => [...prev, ...importedItems])
    setShowImportMeal(false)
    toast(`✓ ${importedItems.length} aliment${importedItems.length > 1 ? 's' : ''} ajouté${importedItems.length > 1 ? 's' : ''}`)
  }

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItemQty = (i, qty) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const f = qty / item.qty_g
      const updated = {
        ...item,
        qty_g: qty,
        energie_kcal: parseFloat((item.energie_kcal * f).toFixed(1)),
        proteines: parseFloat((item.proteines * f).toFixed(2)),
        glucides: parseFloat((item.glucides * f).toFixed(2)),
        lipides: parseFloat((item.lipides * f).toFixed(2)),
        fibres: parseFloat(((item.fibres || 0) * f).toFixed(2)),
      }
      for (const key of ALL_NUTRIENT_KEYS) {
        const raw = item[key]
        updated[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
      }
      return updated
    }))
  }

  const save = async () => {
    if (!nom.trim()) { toast('Donne un nom au repas'); return }
    if (items.length === 0) { toast('Ajoute au moins un aliment'); return }
    setSaving(true)
    await onSave({ nom: nom.trim(), description: desc.trim(), items, nb_portions: portions, categories })
    setSaving(false)
  }

  if (showAddFood) {
    return (
      <AddFoodModal
        initialMeal="Déjeuner"
        onAdd={handleAddFood}
        onClose={() => setShowAddFood(false)}
      />
    )
  }

  if (showImportMeal) {
    return (
      <ImportFromDayModal
        onImport={handleImportMeal}
        onClose={() => setShowImportMeal(false)}
      />
    )
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2>{repas?.id ? 'Modifier le repas' : 'Nouveau repas type'}</h2>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>

      <div className="page-modal-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Nom du repas *</div>
            <input className="input" placeholder="Ex: Bol protéiné du midi" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Description (optionnel)</div>
            <input className="input" placeholder="Ex: Repas post-entraînement" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Nombre de portions</div>
            <input className="input" type="number" min={1} value={portions} onChange={e => setPortions(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Catégories</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RECIPE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="chip"
                  style={categories.includes(cat) ? undefined : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
                >
                  {getRecipeCategoryIcon(cat)} {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Aliments ({items.length})</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setShowImportMeal(true)}
                style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <CalendarDays size={14} /> Importer
              </button>
              <button
                onClick={() => setShowAddFood(true)}
                style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
          </div>

          {items.length === 0 && (
            <EmptyState style={{ padding: '20px 10px' }}>Aucun aliment ajouté</EmptyState>
          )}

          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.food_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(item.energie_kcal || 0)} kcal</div>
              </div>
              <input
                type="number"
                value={item.qty_g}
                onChange={e => updateItemQty(i, parseFloat(e.target.value) || 0)}
                style={{ width: 60, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '5px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', outline: 'none', background: 'var(--gray-bg)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>g</span>
              <button className="btn-icon" onClick={() => removeItem(i)} style={{ color: 'var(--text-hint)' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : '💾 Sauvegarder le repas'}
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
