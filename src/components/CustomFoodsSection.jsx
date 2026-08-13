import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import { ChevronLeft, ChevronDown, PlusCircle, Pencil, Trash2, Apple } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { SUGAR_FIELDS, FAT_FIELDS, VITAMIN_FIELDS, MINERAL_FIELDS, DETAIL_ONLY_FIELDS, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import Loader from './Loader'
import EmptyState from './EmptyState'

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
// CustomFoodsSection — contenu de l'onglet "Aliments" dans ManualPage.
// Le formulaire (view === 'form') prend toute la page, indépendamment de
// l'onglet actif — c'est pourquoi on notifie le parent via onFormOpenChange,
// qui masque alors son propre header/switch d'onglets (même comportement
// qu'avant l'extraction). `active` contrôle uniquement l'affichage de la
// liste quand on n'est PAS dans le formulaire.
// startNew() est exposée via ref pour le menu "Nouveau" partagé (ManualPage),
// qui vit en dehors de cet onglet.
// ─────────────────────────────────────────────────────────────────────────────
const CustomFoodsSection = forwardRef(function CustomFoodsSection({ active, onFormOpenChange }, ref) {
  const toast    = useToast()
  const { user } = useAuth()

  const [view,      setView]      = useState('list') // list | form
  const [aliments,  setAliments]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [extra,     setExtra]     = useState({})
  const [portions,  setPortions]  = useState([{ label: '', g: '' }])
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { load() }, [user])

  useEffect(() => { onFormOpenChange?.(view === 'form') }, [view])

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

  useImperativeHandle(ref, () => ({ startNew }))

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
  // Vue : formulaire aliment — prend toute la page, indépendamment de l'onglet
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

  if (!active) return null

  return (
    <>
      {loading && <Loader />}
      {!loading && aliments.length === 0 && (
        <EmptyState icon={<Apple size={40} />} title="Aucun aliment personnalisé" description="Ajoute un aliment qui n'existe pas dans Ciqual" />
      )}
      {aliments.map(a => <FoodCard key={a.id} aliment={a} onEdit={startEdit} onDelete={handleDelete} />)}
    </>
  )
})

export default CustomFoodsSection
