import React, { useState, useEffect, useRef, useMemo  } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { PlusCircle, ChevronDown, ChevronLeft, Plus, Pencil, Trash2, Apple, UtensilsCrossed, X, Search, CalendarDays, ArrowUpDown  } from 'lucide-react'
import { SUGAR_FIELDS, FAT_FIELDS, VITAMIN_FIELDS, MINERAL_FIELDS, DETAIL_ONLY_FIELDS, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import RecipeFormModal from '../components/RecipeFormModal'
import RecipeDetailWrapper from '../components/RecipeDetailWrapper'
import MealTemplatesSection from '../components/MealTemplatesSection'
import PlanMealModal from '../components/PlanMealModal'
import SortModal from '../components/SortModal'
import { DEFAULT_SORT, sortRecettes, describeSortField, isCustomSort } from '../lib/recipeSort'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes formulaire aliment personnalisé
// ─────────────────────────────────────────────────────────────────────────────

const VITAMIN_DETAIL_FIELDS = [
  ...VITAMIN_FIELDS,
  ...DETAIL_ONLY_FIELDS.filter(f => ['retinol', 'beta_carotene', 'vit_d2', 'vit_d3', 'vit_k2', 'folates_intrinseques', 'acide_folique'].includes(f.key)),
]

// Les clés gérées dans le formulaire principal — exclues des sections détail
// pour éviter toute double saisie et tout double comptage.
const MAIN_FORM_KEYS = new Set(['sucres', 'acides_gras_satures', 'sel'])

const EXTRA_SECTIONS = [
  {
    title: 'Sucres (détail par type)',
    // 'sucres' (total) est déjà dans le formulaire principal → on l'exclut ici
    fields: SUGAR_FIELDS.filter(f => !MAIN_FORM_KEYS.has(f.key)),
  },
  {
    title: 'Acides gras (détail par type)',
    // 'acides_gras_satures' et 'sel' sont déjà dans le formulaire principal → exclus
    fields: FAT_FIELDS.filter(f => !MAIN_FORM_KEYS.has(f.key)),
  },
  { title: 'Vitamines', fields: VITAMIN_DETAIL_FIELDS },
  { title: 'Minéraux',  fields: MINERAL_FIELDS },
]

const EMPTY_FORM = {
  nom: '', marque: '', categorie: 'Personnalisé',
  energie_kcal: '', proteines: '', glucides: '', lipides: '',
  fibres: '', sel: '', sucres: '', acides_gras_satures: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// MacroField — champ de saisie numérique réutilisable
// ─────────────────────────────────────────────────────────────────────────────
function MacroField({ label, id, value, onChange, unit = 'g', required = false, placeholder = '0' }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}{required ? ' *' : ''}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          type="number"
          min={0}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(id, e.target.value)}
          style={{ paddingRight: 40 }}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 11, color: 'var(--text-hint)', pointerEvents: 'none',
        }}>
          {unit}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ExtraSection — section dépliable pour les détails nutriments
// ─────────────────────────────────────────────────────────────────────────────
function ExtraSection({ title, fields, extra, setExtraField }) {
  const [open, setOpen] = useState(false)

  // Ne pas afficher la section si tous les champs ont été filtrés
  if (!fields || fields.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <ChevronDown
          size={18}
          color="var(--text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
        />
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}</div>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={extra[f.key] || ''}
                  onChange={e => setExtraField(f.key, e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, color: 'var(--text-hint)', pointerEvents: 'none',
                }}>
                  {f.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FoodCard — carte aliment dans la liste
// ─────────────────────────────────────────────────────────────────────────────
function FoodCard({ aliment, onEdit, onDelete }) {
  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {aliment.nom}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {aliment.marque ? `${aliment.marque} · ` : ''}{Math.round(aliment.energie_kcal || 0)} kcal/100g
          &nbsp;·&nbsp;<span className="c-prot">P {Math.round(aliment.proteines || 0)}g</span>
          &nbsp;<span className="c-gluc">G {Math.round(aliment.glucides || 0)}g</span>
          &nbsp;<span className="c-lip">L {Math.round(aliment.lipides || 0)}g</span>
        </div>
      </div>
      <button className="btn-icon" onClick={() => onEdit(aliment)}      style={{ color: 'var(--text-hint)' }}><Pencil size={16} /></button>
      <button className="btn-icon" onClick={() => onDelete(aliment.id)} style={{ color: 'var(--text-hint)' }}><Trash2 size={16} /></button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeCard — carte d'une recette dans la liste
// ─────────────────────────────────────────────────────────────────────────────
function RecipeCard({ recette, ingredients, onOpen, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasIngredients = ingredients && ingredients.length > 0

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => onOpen(recette)}
        >
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recette.nom}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {recette.energie_kcal != null ? `${Math.round(recette.energie_kcal)} kcal/100g` : 'Aucun ingrédient'}
            {recette.portions > 1 && <span style={{ marginLeft: 6, color: 'var(--text-hint)' }}>· {recette.portions} portions</span>}
            {recette.poids_cuit_g && <span style={{ marginLeft: 6, color: 'var(--blue)', fontSize: 11 }}>⚖️ pesé</span>}
          </div>

          {recette.energie_kcal != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              <span className="c-prot">P {Math.round(recette.proteines || 0)}g</span>&nbsp;
              <span className="c-gluc">G {Math.round(recette.glucides  || 0)}g</span>&nbsp;
              <span className="c-lip">L {Math.round(recette.lipides   || 0)}g</span>
              <span style={{ color: 'var(--text-hint)' }}> /100g</span>
            </div>
          )}

          {(() => {
            const portions       = recette.portions || 1
            const poidsRef        = recette.poids_cuit_g || recette.poids_cru_g || null
            const poidsParPortion = poidsRef ? poidsRef / portions : null
            const factor          = poidsParPortion ? poidsParPortion / 100 : null
            if (recette.energie_kcal == null || factor == null) return null
            return (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {Math.round(recette.energie_kcal * factor)} kcal&nbsp;·&nbsp;
                <span className="c-prot">P {Math.round((recette.proteines || 0) * factor)}g</span>&nbsp;
                <span className="c-gluc">G {Math.round((recette.glucides  || 0) * factor)}g</span>&nbsp;
                <span className="c-lip">L {Math.round((recette.lipides   || 0) * factor)}g</span>
                <span style={{ color: 'var(--text-hint)' }}> /portion ({Math.round(poidsParPortion)}g)</span>
              </div>
            )
          })()}
        </div>

        {/* ── Toggle ingrédients ── */}
        {hasIngredients && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="btn-icon"
            style={{ color: 'var(--text-hint)', flexShrink: 0 }}
          >
            <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}
        <button
          className="btn-icon"
          onClick={e => { e.stopPropagation(); onDelete(recette.id) }}
          style={{ color: 'var(--text-hint)', flexShrink: 0 }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Liste ingrédients + grammage (dépliable) ── */}
      {expanded && hasIngredients && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          {ingredients.map((ing, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 8,
                fontSize: 12, color: 'var(--text-muted)', padding: '3px 0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</span>
              <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text)' }}>{ing.qty_g} g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-menu "Nouveau" (dropdown)
// ─────────────────────────────────────────────────────────────────────────────
function NewMenu({ onNewAliment, onNewRecette, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50, minWidth: 180,
      background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border-md)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden',
    }}>
      <button
        onClick={() => { onClose(); onNewAliment() }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)', borderBottom: '0.5px solid var(--border)' }}
      >
        <Apple size={17} color="var(--green)" />
        Nouvel aliment
      </button>
      <button
        onClick={() => { onClose(); onNewRecette() }}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font)', color: 'var(--text)' }}
      >
        <UtensilsCrossed size={17} color="var(--green)" />
        Nouvelle recette
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper pour charger ingrédients + afficher RecipeFormModal en édition
// ─────────────────────────────────────────────────────────────────────────────
function RecipeEditWrapper({ recette, onSaved, onClose }) {
  const { ingredients, loading } = useRecetteDetail(recette.id)
  if (loading) return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32 }} />
        <h2>Chargement...</h2>
        <button className="btn-icon" onClick={() => window.history.back()}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="loader"><div className="spinner" /> Chargement...</div>
    </div>
  )
  return <RecipeFormModal recette={recette} ingredients={ingredients} onSaved={onSaved} onClose={onClose} />
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualPage — page principale
// ─────────────────────────────────────────────────────────────────────────────
export default function ManualPage() {
  const toast    = useToast()
  const { user } = useAuth()

  // ── Onglet actif : 'aliments' | 'recettes' | 'repas' ────────────────────
  const [tab, setTab] = useState('aliments')

  // ── Aliments ─────────────────────────────────────────────────────────────
  const [view,      setView]      = useState('list') // list | form
  const [aliments,  setAliments]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [extra,     setExtra]     = useState({})
  const [portions,  setPortions]  = useState([{ label: '', g: '' }])
  const [saving,    setSaving]    = useState(false)

  // ── Recettes ──────────────────────────────────────────────────────────────
  const { recettes, ingredientsByRecette, loading: loadingRecettes, deleteRecette, refetch: refetchRecettes } = useRecipes()
  const [recipeSearch, setRecipeSearch] = useState('')

  // Normalise pour une recherche insensible à la casse et aux accents
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filteredRecettes = useMemo(() => {
    const q = normalize(recipeSearch.trim())
    if (!q) return recettes
    return recettes.filter(r => {
      if (normalize(r.nom).includes(q)) return true
      const ings = ingredientsByRecette[r.id] || []
      return ings.some(ing => normalize(ing.food_name).includes(q))
    })
  }, [recettes, ingredientsByRecette, recipeSearch])

  // ── Tri des recettes ──────────────────────────────────────────────────────
  const [recipeSort, setRecipeSort] = useState(DEFAULT_SORT)
  const [sortModalOpen, setSortModalOpen] = useState(false)

  const sortedFilteredRecettes = useMemo(
    () => sortRecettes(filteredRecettes, recipeSort),
    [filteredRecettes, recipeSort]
  )

  const recipeSortActive = isCustomSort(recipeSort)

  const [recipeModal, setRecipeModal] = useState(null) // null | { type: 'new' | 'edit' | 'detail', recette? }
  const [planTarget, setPlanTarget] = useState(null) // preset source { nom, items, sourceType, sourceId } en cours de planification

  // ── Sous-menu "Nouveau" ───────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef(null)

  useEffect(() => { load() }, [user])

  const load = async () => {
    if (!user) { setAliments([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('aliments_custom')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setAliments(data || [])
    setLoading(false)
  }

  const set           = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setExtraField = (k, v) => setExtra(e => ({ ...e, [k]: v }))
  const addPortion    = () => setPortions(p => [...p, { label: '', g: '' }])
  const removePortion = (i) => setPortions(p => p.filter((_, idx) => idx !== i))
  const updatePortion = (i, k, v) => setPortions(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

  const resetForm = () => { setForm(EMPTY_FORM); setExtra({}); setPortions([{ label: '', g: '' }]); setEditingId(null) }
  const startNew  = () => { resetForm(); setView('form') }

  const startEdit = (aliment) => {
    setEditingId(aliment.id)
    setForm({
      nom: aliment.nom || '', marque: aliment.marque || '', categorie: aliment.categorie || 'Personnalisé',
      energie_kcal: aliment.energie_kcal ?? '', proteines: aliment.proteines ?? '',
      glucides: aliment.glucides ?? '', lipides: aliment.lipides ?? '', fibres: aliment.fibres ?? '',
      sel: aliment.sel ?? '', sucres: aliment.sucres ?? '', acides_gras_satures: aliment.acides_gras_satures ?? '',
    })
    const extraValues = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      if (MAIN_FORM_KEYS.has(key)) continue
      extraValues[key] = aliment[key] != null ? String(aliment[key]) : ''
    }
    setExtra(extraValues)
    setPortions(
      Array.isArray(aliment.portions) && aliment.portions.length
        ? aliment.portions.map(p => ({ label: p.label || '', g: p.g != null ? String(p.g) : '' }))
        : [{ label: '', g: '' }]
    )
    setView('form')
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('aliments_custom').delete().eq('id', id).eq('user_id', user.id)
    if (!error) { setAliments(a => a.filter(x => x.id !== id)); toast('Supprimé') }
    else toast('Erreur lors de la suppression')
  }

  const save = async () => {
    if (!form.nom.trim())   { toast('⚠ Donne un nom');        return }
    if (!form.energie_kcal) { toast('⚠ Entre les calories');  return }
    setSaving(true)
    const cleanPortions = portions.filter(p => p.label && p.g).map(p => ({ label: p.label, g: parseFloat(p.g) }))
    const extraValues   = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      // Les clés du formulaire principal sont déjà dans `form` — ne pas les écraser
      if (MAIN_FORM_KEYS.has(key)) continue
      extraValues[key] = extra[key] ? parseFloat(extra[key]) : null
    }
    const payload = {
      nom: form.nom.trim(), marque: form.marque.trim() || null, categorie: form.categorie || 'Personnalisé',
      energie_kcal:        parseFloat(form.energie_kcal)        || 0,
      proteines:           parseFloat(form.proteines)           || 0,
      glucides:            parseFloat(form.glucides)            || 0,
      lipides:             parseFloat(form.lipides)             || 0,
      fibres:              parseFloat(form.fibres)              || 0,
      sel:                 parseFloat(form.sel)                 || 0,
      sucres:              parseFloat(form.sucres)              || 0,
      acides_gras_satures: parseFloat(form.acides_gras_satures) || 0,
      ...extraValues,
      portions: cleanPortions,
    }
    const { error } = editingId
      ? await supabase.from('aliments_custom').update(payload).eq('id', editingId).eq('user_id', user.id)
      : await supabase.from('aliments_custom').insert([{ ...payload, user_id: user.id }])
    setSaving(false)
    if (!error) { toast(editingId ? '✓ Aliment modifié !' : '✓ Aliment sauvegardé !'); resetForm(); setView('list'); load() }
    else toast('Erreur lors de la sauvegarde')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vue : formulaire aliment
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="page-content">
        {/* ── En-tête formulaire ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button className="btn-icon" onClick={() => { resetForm(); setView('list') }} style={{ marginLeft: -8 }}>
            <ChevronLeft size={20} color="var(--text-muted)" />
          </button>
          <div style={{ fontWeight: 700, fontSize: 20 }}>
            {editingId ? "Modifier l'aliment" : 'Nouvel aliment'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, marginLeft: 36 }}>
          {editingId ? 'Mets à jour les valeurs nutritionnelles' : "Ajoute un aliment qui n'existe pas dans Ciqual"}
        </div>

        {/* ── Informations ── */}
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div className="section-title">Informations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nom *</div>
              <input
                className="input"
                placeholder="Ex: Galette de riz maison"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Marque</div>
                <input className="input" placeholder="Optionnel" value={form.marque} onChange={e => set('marque', e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Catégorie</div>
                <input className="input" placeholder="Personnalisé" value={form.categorie} onChange={e => set('categorie', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Valeurs pour 100g ── */}
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div className="section-title">Valeurs pour 100g</div>

          {/* Ligne 1 : Calories + Protéines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <MacroField id="energie_kcal" label="Calories" unit="kcal" required value={form.energie_kcal} onChange={set} />
            <MacroField id="proteines"    label="Protéines"             value={form.proteines}    onChange={set} />
          </div>

          {/* Ligne 2 : Fibres + Sel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <MacroField id="fibres" label="Fibres" value={form.fibres} onChange={set} />
            <MacroField id="sel"    label="Sel"    value={form.sel}    onChange={set} />
          </div>

          {/* Ligne 3 : Glucides (+ dont sucres) | Lipides (+ dont AG saturés)
              Reproduit exactement la structure d'une étiquette alimentaire :
              "Glucides Xg  dont sucres Yg"  /  "Lipides Xg  dont AG saturés Yg"
              → recopiage direct, sans aucune soustraction à faire.           */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

            {/* Colonne Glucides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <MacroField id="glucides" label="Glucides" value={form.glucides} onChange={set} />
              {/* Champ "dont" — indenté visuellement comme sur l'étiquette */}
              <div style={{
                marginLeft: 10,
                paddingLeft: 10,
                borderLeft: '2px solid var(--border)',
              }}>
                <MacroField id="sucres" label="dont sucres" value={form.sucres} onChange={set} />
              </div>
            </div>

            {/* Colonne Lipides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <MacroField id="lipides" label="Lipides" value={form.lipides} onChange={set} />
              {/* Champ "dont" — indenté visuellement comme sur l'étiquette */}
              <div style={{
                marginLeft: 10,
                paddingLeft: 10,
                borderLeft: '2px solid var(--border)',
              }}>
                <MacroField id="acides_gras_satures" label="dont AG saturés" value={form.acides_gras_satures} onChange={set} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Sections détail (facultatif) ── */}
        <div style={{ marginBottom: 4 }}><div className="section-title">Détails (facultatif)</div></div>

        {EXTRA_SECTIONS.map(section => (
          <ExtraSection
            key={section.title}
            title={section.title}
            fields={section.fields}
            extra={extra}
            setExtraField={setExtraField}
          />
        ))}

        {/* ── Portions courantes ── */}
        <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Portions courantes</div>
            <button
              onClick={addPortion}
              style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <PlusCircle size={14} /> Ajouter
            </button>
          </div>
          {portions.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Ex: 1 oeuf"
                value={p.label}
                onChange={e => updatePortion(i, 'label', e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                type="number"
                placeholder="g"
                value={p.g}
                onChange={e => updatePortion(i, 'g', e.target.value)}
                style={{ width: 70 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>g</span>
              {portions.length > 1 && (
                <button onClick={() => removePortion(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
        </div>

        {/* ── Bouton sauvegarde ── */}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : editingId ? '💾 Enregistrer les modifications' : "💾 Sauvegarder l'aliment"}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10 }}>
          L'aliment sera disponible dans la recherche
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vue : liste principale (aliments + recettes)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-content">
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>Mes aliments</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aliments et recettes personnalisés</div>
          </div>
          <div style={{ position: 'relative' }} ref={menuBtnRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'var(--green)', color: 'white', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Plus size={16} /> Nouveau
            </button>
            {menuOpen && (
              <NewMenu
                onClose={() => setMenuOpen(false)}
                onNewAliment={startNew}
                onNewRecette={() => setRecipeModal({ type: 'new' })}
              />
            )}
          </div>
        </div>

        {/* ── Switch tabs ── */}
        <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16 }}>
          {[
            { key: 'aliments', label: 'Aliments', icon: <Apple size={14} /> },
            { key: 'recettes', label: 'Recettes', icon: <UtensilsCrossed size={14} /> },
            { key: 'repas',    label: 'Repas types', icon: <CalendarDays size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
                background: tab === t.key ? 'var(--white)' : 'transparent',
                color:      tab === t.key ? 'var(--text)'  : 'var(--text-muted)',
                boxShadow:  tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Onglet Aliments ── */}
        {tab === 'aliments' && (
          <>
            {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}
            {!loading && aliments.length === 0 && (
              <div className="empty">
                <Apple size={40} />
                <div style={{ marginTop: 8, fontWeight: 600 }}>Aucun aliment personnalisé</div>
                <div style={{ marginTop: 4 }}>Ajoute un aliment qui n'existe pas dans Ciqual</div>
              </div>
            )}
            {aliments.map(a => <FoodCard key={a.id} aliment={a} onEdit={startEdit} onDelete={handleDelete} />)}
          </>
        )}

        {/* ── Onglet Recettes ── */}
        {tab === 'recettes' && (
          <>
            {/* ── Barre de recherche + tri ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="input"
                  placeholder="Rechercher une recette ou un ingrédient..."
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  style={{ paddingLeft: 36, paddingRight: recipeSearch ? 36 : 12 }}
                />
                {recipeSearch && (
                  <button
                    onClick={() => setRecipeSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setSortModalOpen(true)}
                style={{
                  width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  background: recipeSortActive ? 'var(--green-light)' : 'var(--gray-bg)',
                  color: recipeSortActive ? 'var(--green-dark)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)',
                }}
              >
                <ArrowUpDown size={17} />
              </button>
            </div>

            {recipeSortActive && (
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 10 }}>
                Trié par {describeSortField(recipeSort.primary)}
                {recipeSort.secondary ? `, puis ${describeSortField(recipeSort.secondary)}` : ''}
              </div>
            )}

            {loadingRecettes && <div className="loader"><div className="spinner" /> Chargement...</div>}

            {!loadingRecettes && sortedFilteredRecettes.length === 0 && (
              <div className="empty">
                <UtensilsCrossed size={40} />
                <div style={{ marginTop: 8, fontWeight: 600 }}>
                  {recipeSearch ? 'Aucun résultat' : 'Aucune recette'}
                </div>
                <div style={{ marginTop: 4 }}>
                  {recipeSearch
                    ? `Aucune recette ni ingrédient ne correspond à "${recipeSearch}"`
                    : "Crée ta première recette pour calculer les calories de tes plats maison"}
                </div>
              </div>
            )}

            {sortedFilteredRecettes.map(r => (
              <RecipeCard
                key={r.id}
                recette={r}
                ingredients={ingredientsByRecette[r.id]}
                onOpen={(rec) => setRecipeModal({ type: 'detail', recette: rec })}
                onDelete={async (id) => { await deleteRecette(id); toast('Supprimé') }}
              />
            ))}
          </>
        )}

        {/* ── Onglet Repas types ── */}
        {tab === 'repas' && <MealTemplatesSection />}

      </div>

      {/* ── Modals recettes ── */}

      {/* Nouvelle recette */}
      {recipeModal?.type === 'new' && (
        <RecipeFormModal
          recette={null}
          ingredients={[]}
          onSaved={() => { setRecipeModal(null); refetchRecettes() }}
          onClose={() => setRecipeModal(null)}
        />
      )}

      {/* Détail recette */}
      {recipeModal?.type === 'detail' && recipeModal.recette && (
        <RecipeDetailWrapper
          recetteId={recipeModal.recette.id}
          onEdit={() => setRecipeModal({ type: 'edit', recette: recipeModal.recette })}
          onDelete={async () => {
            await deleteRecette(recipeModal.recette.id)
            toast('Recette supprimée')
            setRecipeModal(null)
          }}
          onClose={() => setRecipeModal(null)}
          onPlan={setPlanTarget}
        />
      )}

      {/* ── Planifier (recette ou repas type) ── */}
      {planTarget && (
        <PlanMealModal
          presetSource={planTarget}
          onClose={() => setPlanTarget(null)}
          onPlanned={() => setPlanTarget(null)}
        />
      )}

      {/* Édition recette */}
      {recipeModal?.type === 'edit' && recipeModal.recette && (
        <RecipeEditWrapper
          recette={recipeModal.recette}
          onSaved={() => { setRecipeModal(null); refetchRecettes() }}
          onClose={() => setRecipeModal(null)}
        />
      )}

      {/* ── Tri des recettes ── */}
      {sortModalOpen && (
        <SortModal
          value={recipeSort}
          onChange={setRecipeSort}
          onClose={() => setSortModalOpen(false)}
        />
      )}
    </>
  )
}