import React, { useState, useMemo } from 'react'
import { Plus, ChevronLeft, Trash2, X, Check, ShoppingCart, Pencil, Lightbulb } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useShoppingLists, useShoppingListItems, itemIdentity } from '../hooks/useShoppingLists'
import { useGroceriesSuggestions } from '../hooks/useGroceriesSuggestions'
import { findField } from '../lib/ciqualExplorer'
import AddFromRecipeModal from '../components/AddFromRecipeModal'
import AddFromMealModal from '../components/AddFromMealModal'
import FoodPicker from '../components/FoodPicker'
import Loader from '../components/Loader'
import FieldLabel from '../components/FieldLabel'
import EmptyState from '../components/EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// NameModal — création / renommage d'une liste
// ─────────────────────────────────────────────────────────────────────────────
function NameModal({ title, initial = '', confirmLabel = 'Créer', onConfirm, onClose }) {
  const [nom, setNom] = useState(initial)
  return (
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>{title}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <input
          className="input"
          placeholder="Ex: Courses de la semaine"
          value={nom}
          onChange={e => setNom(e.target.value)}
          autoFocus
          style={{ marginBottom: 16 }}
        />
        <button
          className="btn-primary"
          disabled={!nom.trim()}
          style={{ opacity: nom.trim() ? 1 : 0.5 }}
          onClick={() => { onConfirm(nom.trim()); onClose() }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAddForm — ajout manuel libre (pas forcément un aliment de la base)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES_SUGGESTIONS = [
  'Fruits et légumes', 'Viandes et poissons', 'Produits laitiers', 'Épicerie',
  'Boissons', 'Surgelés', 'Boulangerie', 'Hygiène et entretien', 'Autre',
]

function QuickAddForm({ onAdd, onClose }) {
  const [nom, setNom] = useState('')
  const [qty, setQty] = useState('')
  const [categorie, setCategorie] = useState('Autre')

  const submit = async () => {
    if (!nom.trim()) return
    await onAdd(nom.trim(), categorie || 'Autre', qty ? parseFloat(qty) : null)
    onClose()
  }

  return (
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ajouter un article</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Nom *</FieldLabel>
          <input className="input" placeholder="Ex: Sacs poubelle" value={nom} onChange={e => setNom(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <FieldLabel>Quantité (g, optionnel)</FieldLabel>
            <input className="input" type="number" min={0} placeholder="—" value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Catégorie</FieldLabel>
            <input className="input" list="categories-suggestions" value={categorie} onChange={e => setCategorie(e.target.value)} />
            <datalist id="categories-suggestions">
              {CATEGORIES_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>
        <button className="btn-primary" disabled={!nom.trim()} style={{ opacity: nom.trim() ? 1 : 0.5 }} onClick={submit}>
          Ajouter
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddMenu — feuille du bas : 3 façons d'ajouter
// ─────────────────────────────────────────────────────────────────────────────
function AddMenu({ onClose, onQuickAdd, onFromFood, onFromRecipe, onFromMeal }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--white)', borderRadius: '16px 16px 0 0', padding: '8px 0 24px' }}
      >
        {[
          { label: 'Chercher un aliment', action: onFromFood },
          { label: 'Depuis une recette', action: onFromRecipe },
          { label: 'Depuis un repas type', action: onFromMeal },
          { label: 'Article libre (non alimentaire...)', action: onQuickAdd },
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => { onClose(); opt.action() }}
            style={{ width: '100%', textAlign: 'left', padding: '14px 20px', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)' }}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{ width: '100%', textAlign: 'center', padding: '14px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text-hint)', marginTop: 4 }}
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ItemRow
// ─────────────────────────────────────────────────────────────────────────────
function ItemRow({ item, onToggle, onDelete }) {
  return (
    <div className="card" style={{ marginBottom: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${item.checked ? 'var(--green)' : 'var(--border-md)'}`,
          background: item.checked ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s',
        }}
      >
        {item.checked && <Check size={13} color="white" strokeWidth={3} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          textDecoration: item.checked ? 'line-through' : 'none',
          color: item.checked ? 'var(--text-hint)' : 'var(--text)',
        }}>
          {item.nom}{item.qty_g ? ` — ${item.qty_g}g` : ''}
        </div>
        {item.recette_noms?.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
            {item.recette_noms.join(', ')}
          </div>
        )}
      </div>

      <button className="btn-icon" onClick={() => onDelete(item.id)} style={{ color: 'var(--text-hint)', flexShrink: 0 }}>
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SuggestionsSection — aliments qui reviennent le plus souvent dans les
// suggestions "À combler aujourd'hui" de la page du jour (voir
// useGroceriesSuggestions), qu'elle n'a pas encore ajoutés à cette liste.
// Un appui sur "+" les ajoute directement, sans quantité (comme un article
// libre) : ce sont des idées à cocher/adapter, pas un grammage calculé pour
// cette liste précise.
// ─────────────────────────────────────────────────────────────────────────────
function SuggestionsSection({ existingKeys, onAdd }) {
  const { suggestions, loading } = useGroceriesSuggestions()

  const toAdd = useMemo(
    () => suggestions.filter(s => !existingKeys.has(itemIdentity({ food_source: s.food_source, food_ref_id: s.food_ref_id, nom: s.food_name }))),
    [suggestions, existingKeys]
  )

  if (loading || toAdd.length === 0) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        Suggestions
      </div>
      {toAdd.map(s => {
        const labels = s.nutrientKeys.map(k => findField(k).label)
        return (
          <div key={`${s.food_source}:${s.food_ref_id ?? s.food_name}`} className="card" style={{ marginBottom: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lightbulb size={16} style={{ color: 'var(--green-dark)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.food_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                Souvent suggéré pour {labels.join(', ')}
              </div>
            </div>
            <button
              onClick={() => onAdd(s)}
              style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              aria-label={`Ajouter ${s.food_name} à la liste`}
            >
              <Plus size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ListeDetail
// ─────────────────────────────────────────────────────────────────────────────
function ListeDetail({ liste, onBack }) {
  const toast = useToast()
  const { items, loading, addItems, addRecetteIngredients, addRepasItems, addSuggestedItem, toggleChecked, deleteItem, clearChecked } = useShoppingListItems(liste.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [foodPickerOpen, setFoodPickerOpen] = useState(false)
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [mealModalOpen, setMealModalOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const cat = item.categorie || 'Autre'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat).push(item)
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return (a.nom || '').localeCompare(b.nom || '', 'fr')
      })
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'))
  }, [items])

  const checkedCount = items.filter(i => i.checked).length
  const existingKeys = useMemo(() => new Set(items.map(itemIdentity)), [items])

  const handleAddSuggestion = async (suggestion) => {
    await addSuggestedItem(suggestion)
    toast('✓ Ajouté')
  }

  const handleFoodPickerConfirm = async (food, qty) => {
    const source = food._source === 'custom' ? 'custom' : food._source === 'off' ? 'off' : 'ciqual'
    const refId  = source === 'ciqual' ? food.alim_code : source === 'custom' ? food.id : null
    await addItems([{
      nom: food.alim_nom,
      categorie: food.categorie || 'Autre',
      qty_g: qty,
      food_source: source,
      food_ref_id: refId,
    }])
    toast('✓ Ajouté')
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button className="btn-icon" onClick={onBack} style={{ marginLeft: -8 }}>
          <ChevronLeft size={20} color="var(--text-muted)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liste.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{checkedCount}/{items.length} article{items.length > 1 ? 's' : ''}</div>
        </div>
        {checkedCount > 0 && (
          <button
            onClick={async () => { await clearChecked(); toast('Cochés supprimés') }}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)', fontFamily: 'var(--font)', flexShrink: 0 }}
          >
            Vider les cochés
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, paddingBottom: 90 }}>
        {loading && <Loader />}

        {!loading && items.length === 0 && (
          <EmptyState icon={<ShoppingCart size={40} />} title="Liste vide" description='Ajoute des articles avec le bouton "+"' />
        )}

        {!loading && <SuggestionsSection existingKeys={existingKeys} onAdd={handleAddSuggestion} />}

        {grouped.map(([cat, catItems]) => (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              {cat}
            </div>
            {catItems.map(item => (
              <ItemRow key={item.id} item={item} onToggle={toggleChecked} onDelete={deleteItem} />
            ))}
          </div>
        ))}
      </div>

      {/* Bouton flottant "+" */}
      <button
        onClick={() => setMenuOpen(true)}
        style={{
          position: 'fixed', bottom: 84, right: 20, zIndex: 40,
          width: 52, height: 52, borderRadius: '50%', background: 'var(--green)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)', border: 'none',
        }}
      >
        <Plus size={24} />
      </button>

      {menuOpen && (
        <AddMenu
          onClose={() => setMenuOpen(false)}
          onQuickAdd={() => setQuickAddOpen(true)}
          onFromFood={() => setFoodPickerOpen(true)}
          onFromRecipe={() => setRecipeModalOpen(true)}
          onFromMeal={() => setMealModalOpen(true)}
        />
      )}

      {quickAddOpen && (
        <QuickAddForm
          onAdd={async (nom, categorie, qty_g) => {
            await addItems([{ nom, categorie, qty_g }])
            toast('✓ Ajouté')
          }}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {foodPickerOpen && (
        <FoodPicker
          title="Ajouter un aliment"
          confirmLabel="Ajouter à la liste"
          includeRecipes={false}
          onConfirm={handleFoodPickerConfirm}
          onClose={() => setFoodPickerOpen(false)}
        />
      )}

      {recipeModalOpen && (
        <AddFromRecipeModal
          onAdd={async (recette, ingredients) => {
            await addRecetteIngredients(recette, ingredients)
            toast('✓ Ingrédients ajoutés')
          }}
          onClose={() => setRecipeModalOpen(false)}
        />
      )}

      {mealModalOpen && (
        <AddFromMealModal
          onAdd={async (repas, items) => {
            await addRepasItems(repas, items)
            toast('✓ Aliments ajoutés')
          }}
          onClose={() => setMealModalOpen(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ListeCard
// ─────────────────────────────────────────────────────────────────────────────
function ListeCard({ liste, onOpen, onDelete, onRename }) {
  return (
    <div
      className="card"
      style={{ marginBottom: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      onClick={() => onOpen(liste)}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'var(--green-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <ShoppingCart size={18} color="var(--green-dark)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liste.nom}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {new Date(liste.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </div>
      </div>
      <button className="btn-icon" onClick={e => { e.stopPropagation(); onRename(liste) }} style={{ color: 'var(--text-hint)' }}>
        <Pencil size={15} />
      </button>
      <button className="btn-icon" onClick={e => { e.stopPropagation(); onDelete(liste.id) }} style={{ color: 'var(--text-hint)' }}>
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ShoppingListPage — page principale (nouvel onglet)
// ─────────────────────────────────────────────────────────────────────────────
export default function ShoppingListPage() {
  const toast = useToast()
  const { listes, loading, createListe, renameListe, deleteListe } = useShoppingLists()
  const [openListe, setOpenListe] = useState(null)
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState(null)

  if (openListe) {
    return <ListeDetail liste={openListe} onBack={() => setOpenListe(null)} />
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Mes courses</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tes listes de courses</div>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{ background: 'var(--green)', color: 'white', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5, border: 'none' }}
        >
          <Plus size={16} /> Nouvelle liste
        </button>
      </div>

      {loading && <Loader />}

      {!loading && listes.length === 0 && (
        <EmptyState icon={<ShoppingCart size={40} />} title="Aucune liste" description="Crée ta première liste de courses" />
      )}

      {listes.map(l => (
        <ListeCard
          key={l.id}
          liste={l}
          onOpen={setOpenListe}
          onRename={(liste) => setRenaming(liste)}
          onDelete={async (id) => { await deleteListe(id); toast('Liste supprimée') }}
        />
      ))}

      {creating && (
        <NameModal
          title="Nouvelle liste"
          confirmLabel="Créer"
          onConfirm={async (nom) => { const { data } = await createListe(nom); if (data) setOpenListe(data) }}
          onClose={() => setCreating(false)}
        />
      )}

      {renaming && (
        <NameModal
          title="Renommer la liste"
          initial={renaming.nom}
          confirmLabel="Enregistrer"
          onConfirm={(nom) => renameListe(renaming.id, nom)}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  )
}