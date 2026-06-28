import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { PlusCircle, ChevronDown, ChevronLeft, Plus, Pencil, Trash2, Apple, UtensilsCrossed, X } from 'lucide-react'
import { SUGAR_FIELDS, FAT_FIELDS, VITAMIN_FIELDS, MINERAL_FIELDS, DETAIL_ONLY_FIELDS, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import RecipeFormModal from '../components/RecipeFormModal'
import RecipeDetailModal from '../components/RecipeDetailModal'

// ─────────────────────────────────────────────────────────────────────────────
// Formulaire aliment personnalisé (inchangé)
// ─────────────────────────────────────────────────────────────────────────────
const FIELDS_LEFT = [
  { id: 'energie_kcal', label: 'Calories', placeholder: '0', unit: 'kcal/100g', required: true },
  { id: 'proteines',    label: 'Protéines', placeholder: '0', unit: 'g/100g' },
  { id: 'glucides',     label: 'Glucides',  placeholder: '0', unit: 'g/100g' },
]
const FIELDS_RIGHT = [
  { id: 'lipides',              label: 'Lipides',            placeholder: '0', unit: 'g/100g' },
  { id: 'fibres',               label: 'Fibres',             placeholder: '0', unit: 'g/100g' },
  { id: 'sel',                  label: 'Sel',                placeholder: '0', unit: 'g/100g' },
  { id: 'sucres',               label: 'Sucres (total)',     placeholder: '0', unit: 'g/100g' },
  { id: 'acides_gras_satures',  label: 'AG saturés (total)', placeholder: '0', unit: 'g/100g' },
]

const VITAMIN_DETAIL_FIELDS = [
  ...VITAMIN_FIELDS,
  ...DETAIL_ONLY_FIELDS.filter(f => ['retinol', 'beta_carotene', 'vit_d2', 'vit_d3', 'vit_k2', 'folates_intrinseques', 'acide_folique'].includes(f.key)),
]

const EXTRA_SECTIONS = [
  { title: 'Sucres (détail par type)',    fields: SUGAR_FIELDS },
  { title: 'Acides gras (détail par type)', fields: FAT_FIELDS },
  { title: 'Vitamines',                   fields: VITAMIN_DETAIL_FIELDS },
  { title: 'Minéraux',                    fields: MINERAL_FIELDS },
]

const EMPTY_FORM = { nom: '', marque: '', categorie: 'Personnalisé', energie_kcal: '', proteines: '', glucides: '', lipides: '', fibres: '', sel: '', sucres: '', acides_gras_satures: '' }

function ExtraSection({ title, fields, extra, setExtraField }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}</div>
              <div style={{ position: 'relative' }}>
                <input className="input" type="number" min={0} placeholder="0" value={extra[f.key] || ''} onChange={e => setExtraField(f.key, e.target.value)} style={{ paddingRight: 40 }} />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-hint)', pointerEvents: 'none' }}>{f.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FoodCard({ aliment, onEdit, onDelete }) {
  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aliment.nom}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {aliment.marque ? `${aliment.marque} · ` : ''}{Math.round(aliment.energie_kcal || 0)} kcal/100g
          &nbsp;·&nbsp;<span className="c-prot">P {Math.round(aliment.proteines || 0)}g</span>
          &nbsp;<span className="c-gluc">G {Math.round(aliment.glucides || 0)}g</span>
          &nbsp;<span className="c-lip">L {Math.round(aliment.lipides || 0)}g</span>
        </div>
      </div>
      <button className="btn-icon" onClick={() => onEdit(aliment)}   style={{ color: 'var(--text-hint)' }}><Pencil  size={16} /></button>
      <button className="btn-icon" onClick={() => onDelete(aliment.id)} style={{ color: 'var(--text-hint)' }}><Trash2  size={16} /></button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeCard — carte d'une recette dans la liste
// ─────────────────────────────────────────────────────────────────────────────
function RecipeCard({ recette, onOpen, onDelete }) {
  return (
    <div
      className="card"
      style={{ marginBottom: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      onClick={() => onOpen(recette)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.nom}</div>
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
          </div>
        )}
      </div>
      <button className="btn-icon" onClick={e => { e.stopPropagation(); onDelete(recette.id) }} style={{ color: 'var(--text-hint)' }}>
        <Trash2 size={16} />
      </button>
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
    <div ref={ref} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 50, minWidth: 180, background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
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
// Wrapper pour charger ingrédients + afficher RecipeDetailModal
// ─────────────────────────────────────────────────────────────────────────────
function RecipeDetailWrapper({ recette, onEdit, onDelete, onClose }) {
  const { ingredients, loading } = useRecetteDetail(recette.id)
  if (loading) return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32 }} />
        <h2>{recette.nom}</h2>
        <button className="btn-icon" onClick={() => window.history.back()}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="loader"><div className="spinner" /> Chargement...</div>
    </div>
  )
  return <RecipeDetailModal recette={recette} ingredients={ingredients} onEdit={onEdit} onDelete={onDelete} onClose={onClose} />
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
  const toast   = useToast()
  const { user } = useAuth()

  // ── Onglet actif : 'aliments' | 'recettes' ──────────────────────────────
  const [tab, setTab] = useState('aliments')

  // ── Aliments ─────────────────────────────────────────────────────────────
  const [view,       setView]       = useState('list') // list | form
  const [aliments,   setAliments]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editingId,  setEditingId]  = useState(null)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [extra,      setExtra]      = useState({})
  const [portions,   setPortions]   = useState([{ label: '', g: '' }])
  const [saving,     setSaving]     = useState(false)

  // ── Recettes ──────────────────────────────────────────────────────────────
  const { recettes, loading: loadingRecettes, deleteRecette, refetch: refetchRecettes } = useRecipes()
  const [recipeModal, setRecipeModal] = useState(null) // null | { type: 'new' | 'edit' | 'detail', recette? }

  // ── Sous-menu "Nouveau" ───────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef(null)

  useEffect(() => { load() }, [user])

  const load = async () => {
    if (!user) { setAliments([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('aliments_custom').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setAliments(data || [])
    setLoading(false)
  }

  const set          = (k, v) => setForm(f => ({ ...f, [k]: v }))
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
      if (key === 'sucres' || key === 'acides_gras_satures' || key === 'sel') continue
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
    if (!form.nom.trim())      { toast('⚠ Donne un nom') ; return }
    if (!form.energie_kcal)    { toast('⚠ Entre les calories') ; return }
    setSaving(true)
    const cleanPortions = portions.filter(p => p.label && p.g).map(p => ({ label: p.label, g: parseFloat(p.g) }))
    const extraValues   = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      if (key === 'sucres' || key === 'acides_gras_satures' || key === 'sel') continue
      extraValues[key] = extra[key] ? parseFloat(extra[key]) : null
    }
    const payload = {
      nom: form.nom.trim(), marque: form.marque.trim() || null, categorie: form.categorie || 'Personnalisé',
      energie_kcal: parseFloat(form.energie_kcal) || 0, proteines: parseFloat(form.proteines) || 0,
      glucides: parseFloat(form.glucides) || 0, lipides: parseFloat(form.lipides) || 0,
      fibres: parseFloat(form.fibres) || 0, sel: parseFloat(form.sel) || 0,
      sucres: parseFloat(form.sucres) || 0, acides_gras_satures: parseFloat(form.acides_gras_satures) || 0,
      ...extraValues, portions: cleanPortions,
    }
    const { error } = editingId
      ? await supabase.from('aliments_custom').update(payload).eq('id', editingId).eq('user_id', user.id)
      : await supabase.from('aliments_custom').insert([{ ...payload, user_id: user.id }])
    setSaving(false)
    if (!error) { toast(editingId ? '✓ Aliment modifié !' : '✓ Aliment sauvegardé !'); resetForm(); setView('list'); load() }
    else toast('Erreur lors de la sauvegarde')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vue : formulaire aliment (inchangée)
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <button className="btn-icon" onClick={() => { resetForm(); setView('list') }} style={{ marginLeft: -8 }}>
            <ChevronLeft size={20} color="var(--text-muted)" />
          </button>
          <div style={{ fontWeight: 700, fontSize: 20 }}>{editingId ? "Modifier l'aliment" : 'Nouvel aliment'}</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, marginLeft: 36 }}>
          {editingId ? 'Mets à jour les valeurs nutritionnelles' : "Ajoute un aliment qui n'existe pas dans Ciqual"}
        </div>

        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div className="section-title">Informations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Nom *</div>
              <input className="input" placeholder="Ex: Galette de riz maison" value={form.nom} onChange={e => set('nom', e.target.value)} />
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

        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div className="section-title">Valeurs pour 100g</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[...FIELDS_LEFT, ...FIELDS_RIGHT].map(f => (
              <div key={f.id}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}{f.required ? ' *' : ''}</div>
                <div style={{ position: 'relative' }}>
                  <input className="input" type="number" min={0} placeholder={f.placeholder} value={form[f.id]} onChange={e => set(f.id, e.target.value)} style={{ paddingRight: 50 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-hint)', pointerEvents: 'none' }}>{f.unit.split('/')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 4 }}><div className="section-title">Détails (facultatif)</div></div>
        {EXTRA_SECTIONS.map(section => (
          <ExtraSection key={section.title} title={section.title} fields={section.fields} extra={extra} setExtraField={setExtraField} />
        ))}

        <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Portions courantes</div>
            <button onClick={addPortion} style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <PlusCircle size={14} /> Ajouter
            </button>
          </div>
          {portions.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="input" placeholder="Ex: 1 oeuf" value={p.label} onChange={e => updatePortion(i, 'label', e.target.value)} style={{ flex: 1 }} />
              <input className="input" type="number" placeholder="g" value={p.g} onChange={e => updatePortion(i, 'g', e.target.value)} style={{ width: 70 }} />
              <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>g</span>
              {portions.length > 1 && <button onClick={() => removePortion(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>}
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : editingId ? '💾 Enregistrer les modifications' : "💾 Sauvegarder l'aliment"}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10 }}>L'aliment sera disponible dans la recherche</div>
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
            { key: 'aliments', label: 'Mes aliments', icon: <Apple size={14} /> },
            { key: 'recettes', label: 'Mes recettes', icon: <UtensilsCrossed size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
                background: tab === t.key ? 'var(--white)' : 'transparent',
                color: tab === t.key ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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
            {loadingRecettes && <div className="loader"><div className="spinner" /> Chargement...</div>}
            {!loadingRecettes && recettes.length === 0 && (
              <div className="empty">
                <UtensilsCrossed size={40} />
                <div style={{ marginTop: 8, fontWeight: 600 }}>Aucune recette</div>
                <div style={{ marginTop: 4 }}>Crée ta première recette pour calculer les calories de tes plats maison</div>
              </div>
            )}
            {recettes.map(r => (
              <RecipeCard
                key={r.id}
                recette={r}
                onOpen={(rec) => setRecipeModal({ type: 'detail', recette: rec })}
                onDelete={async (id) => { await deleteRecette(id); toast('Supprimé') }}
              />
            ))}
          </>
        )}
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
          recette={recipeModal.recette}
          onEdit={() => setRecipeModal({ type: 'edit', recette: recipeModal.recette })}
          onDelete={async () => {
            await deleteRecette(recipeModal.recette.id)
            toast('Recette supprimée')
            setRecipeModal(null)
          }}
          onClose={() => setRecipeModal(null)}
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
    </>
  )
}