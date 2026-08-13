import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import { ChevronLeft, ChevronDown, PlusCircle, Pencil, Trash2, Apple } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { SUGAR_FIELDS, FAT_FIELDS, VITAMIN_FIELDS, MINERAL_FIELDS, DETAIL_ONLY_FIELDS, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import Loader from './Loader'
import EmptyState from './EmptyState'
import FieldLabel from './FieldLabel'

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

// Grandes catégories Ciqual (regroupements officiels à effectif significatif dans
// la table `ciqual` — les variantes de casse et catégories orphelines à effectif
// quasi nul héritées d'anciens imports ne sont pas proposées ici, mais restent
// affichées si un aliment existant les utilise déjà).
const CIQUAL_CATEGORIES = [
  'Aides culinaires et ingrédients divers',
  'Aliments infantiles',
  'Eaux et autres boissons',
  'Entrées et plats composés',
  'Fruits, légumes, légumineuses et oléagineux',
  'Glaces et sorbets',
  'Matières grasses',
  'Produits céréaliers',
  'Produits laitiers',
  'Produits sucrés',
  'Viandes, oeufs, poissons',
]

const CATEGORIES = ['Personnalisé', 'Compléments alimentaires', ...CIQUAL_CATEGORIES]

const COMPLEMENT_CATEGORY = 'Compléments alimentaires'

// Types de dose courants pour les compléments — le poids par défaut est une
// estimation grossière, l'utilisateur peut toujours le corriger.
const DOSE_TYPES = [
  { key: 'gelule',         label: 'Gélule',           defaultG: 0.5 },
  { key: 'comprime',       label: 'Comprimé',         defaultG: 1 },
  { key: 'sachet',         label: 'Sachet',           defaultG: 5 },
  { key: 'cuillere_cafe',  label: 'Cuillère à café',  defaultG: 5 },
  { key: 'cuillere_soupe', label: 'Cuillère à soupe', defaultG: 15 },
  { key: 'ml',             label: 'Ml (liquide)',     defaultG: 1 },
  { key: 'autre',          label: 'Autre',            defaultG: null },
]

// Évite le bruit en virgule flottante (ex: 0.1 * 200 = 20.000000000000004)
// après application du facteur de conversion dose ↔ 100g.
const round = (n) => Math.round(n * 1e6) / 1e6

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
      <FieldLabel>
        {label}{required ? ' *' : ''}
      </FieldLabel>
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
              <FieldLabel>{f.label}</FieldLabel>
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
  // Pour un complément, les valeurs sont stockées pour 100g (comme le reste du
  // schéma) mais l'utilisateur les pense "par dose" — on reconvertit pour
  // l'affichage à partir de la dose (1ère portion), plutôt que d'afficher un
  // "kcal/100g" démesuré et sans rapport avec ce qui a été saisi.
  const dose  = aliment.categorie === COMPLEMENT_CATEGORY ? aliment.portions?.[0] : null
  const scale = dose?.g > 0 ? dose.g / 100 : 1
  const unit  = dose?.g > 0 ? `/${dose.label}` : '/100g'

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {aliment.nom}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {aliment.marque ? `${aliment.marque} · ` : ''}{Math.round((aliment.energie_kcal || 0) * scale)} kcal{unit}
          &nbsp;·&nbsp;<span className="c-prot">P {Math.round((aliment.proteines || 0) * scale)}g</span>
          &nbsp;<span className="c-gluc">G {Math.round((aliment.glucides || 0) * scale)}g</span>
          &nbsp;<span className="c-lip">L {Math.round((aliment.lipides || 0) * scale)}g</span>
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

  // Saisie "par dose" pour la catégorie Compléments alimentaires — voir save()
  // et startEdit() pour la conversion vers/depuis les valeurs pour 100g stockées.
  const [doseTypeKey, setDoseTypeKey] = useState(DOSE_TYPES[0].key)
  const [doseLabel,   setDoseLabel]   = useState('') // libellé perso si doseTypeKey === 'autre'
  const [doseWeight,  setDoseWeight]  = useState(String(DOSE_TYPES[0].defaultG))

  const isComplement = form.categorie === COMPLEMENT_CATEGORY

  const setDoseType = (key) => {
    setDoseTypeKey(key)
    const dt = DOSE_TYPES.find(d => d.key === key)
    if (dt?.defaultG != null) setDoseWeight(String(dt.defaultG))
  }

  const resolveDoseLabel = () => {
    if (doseTypeKey === 'autre') return doseLabel.trim() || 'Dose'
    return `1 ${DOSE_TYPES.find(d => d.key === doseTypeKey).label.toLowerCase()}`
  }

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

  const resetForm = () => {
    setForm(EMPTY_FORM); setExtra({}); setPortions([{ label: '', g: '' }]); setEditingId(null)
    setDoseType(DOSE_TYPES[0].key); setDoseLabel('')
  }
  const startNew  = () => { resetForm(); setView('form') }

  useImperativeHandle(ref, () => ({ startNew }))

  const startEdit = (aliment) => {
    setEditingId(aliment.id)
    const categorie = aliment.categorie || 'Personnalisé'
    const isComp = categorie === COMPLEMENT_CATEGORY
    const firstPortion = isComp && Array.isArray(aliment.portions) ? aliment.portions[0] : null
    // Poids de la dose utilisé pour reconvertir les valeurs stockées (pour 100g)
    // en valeurs "par dose" affichées dans le formulaire.
    const doseW  = firstPortion?.g > 0 ? firstPortion.g : 1
    const factor = isComp ? doseW / 100 : 1

    if (isComp) {
      const matched = DOSE_TYPES.find(d => d.key !== 'autre' && `1 ${d.label.toLowerCase()}` === (firstPortion?.label || '').toLowerCase())
      if (matched) { setDoseTypeKey(matched.key) } else { setDoseTypeKey('autre'); setDoseLabel(firstPortion?.label || '') }
      setDoseWeight(String(doseW))
    } else {
      setDoseType(DOSE_TYPES[0].key); setDoseLabel('')
    }

    const scale = v => v == null ? '' : String(round(v * factor))
    setForm({
      nom: aliment.nom || '', marque: aliment.marque || '', categorie,
      energie_kcal: scale(aliment.energie_kcal), proteines: scale(aliment.proteines),
      glucides: scale(aliment.glucides), lipides: scale(aliment.lipides), fibres: scale(aliment.fibres),
      sel: scale(aliment.sel), sucres: scale(aliment.sucres), acides_gras_satures: scale(aliment.acides_gras_satures),
    })
    const extraValues = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      if (MAIN_FORM_KEYS.has(key)) continue
      extraValues[key] = aliment[key] != null ? String(round(aliment[key] * factor)) : ''
    }
    setExtra(extraValues)
    setPortions(
      !isComp && Array.isArray(aliment.portions) && aliment.portions.length
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
    const doseW = parseFloat(doseWeight) || 0
    if (isComplement && doseW <= 0) { toast("⚠ Indique le poids d'une dose"); return }
    setSaving(true)
    // Les valeurs saisies pour un complément sont "par dose" — on les convertit
    // vers l'équivalent pour 100g attendu par le schéma (comme ciqual/recettes).
    const factor = isComplement ? 100 / doseW : 1
    const cleanPortions = isComplement
      ? [{ label: resolveDoseLabel(), g: doseW }]
      : portions.filter(p => p.label && p.g).map(p => ({ label: p.label, g: parseFloat(p.g) }))
    const extraValues   = {}
    for (const key of ALL_NUTRIENT_KEYS) {
      // Les clés du formulaire principal sont déjà dans `form` — ne pas les écraser
      if (MAIN_FORM_KEYS.has(key)) continue
      extraValues[key] = extra[key] ? round(parseFloat(extra[key]) * factor) : null
    }
    const payload = {
      nom: form.nom.trim(), marque: form.marque.trim() || null, categorie: form.categorie || 'Personnalisé',
      energie_kcal:        round((parseFloat(form.energie_kcal)        || 0) * factor),
      proteines:           round((parseFloat(form.proteines)           || 0) * factor),
      glucides:            round((parseFloat(form.glucides)            || 0) * factor),
      lipides:             round((parseFloat(form.lipides)             || 0) * factor),
      fibres:              round((parseFloat(form.fibres)              || 0) * factor),
      sel:                 round((parseFloat(form.sel)                 || 0) * factor),
      sucres:              round((parseFloat(form.sucres)              || 0) * factor),
      acides_gras_satures: round((parseFloat(form.acides_gras_satures) || 0) * factor),
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
      <>
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
              <FieldLabel>Nom *</FieldLabel>
              <input
                className="input"
                placeholder="Ex: Galette de riz maison"
                value={form.nom}
                onChange={e => set('nom', e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <FieldLabel>Marque</FieldLabel>
                <input className="input" placeholder="Optionnel" value={form.marque} onChange={e => set('marque', e.target.value)} />
              </div>
              <div>
                <FieldLabel>Catégorie</FieldLabel>
                <select className="input" value={form.categorie} onChange={e => set('categorie', e.target.value)}>
                  {(CATEGORIES.includes(form.categorie) ? CATEGORIES : [form.categorie, ...CATEGORIES]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Dose (compléments uniquement) ── */}
        {isComplement && (
          <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
            <div className="section-title">Dose</div>
            <div style={{ display: 'grid', gridTemplateColumns: doseTypeKey === 'autre' ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <FieldLabel>Type de dose</FieldLabel>
                <select className="input" value={doseTypeKey} onChange={e => setDoseType(e.target.value)}>
                  {DOSE_TYPES.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>
              {doseTypeKey === 'autre' && (
                <div>
                  <FieldLabel>Nom de la dose</FieldLabel>
                  <input className="input" placeholder="Ex: 1 dosette" value={doseLabel} onChange={e => setDoseLabel(e.target.value)} />
                </div>
              )}
            </div>
            <MacroField id="doseWeight" label="Poids d'une dose" unit="g" required value={doseWeight} onChange={(_, v) => setDoseWeight(v)} placeholder="0.5" />
          </div>
        )}

        {/* ── Valeurs pour 100g / par dose ── */}
        <div className="card" style={{ padding: '16px', marginBottom: 12 }}>
          <div className="section-title">{isComplement ? 'Valeurs par dose' : 'Valeurs pour 100g'}</div>

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

        {/* ── Portions courantes (pas pour les compléments : la dose ci-dessus
              sert déjà de portion unique) ── */}
        {!isComplement && (
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
        )}

        {/* ── Bouton sauvegarde ── */}
        <button className="btn-primary" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : editingId ? '💾 Enregistrer les modifications' : "💾 Sauvegarder l'aliment"}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', marginTop: 10 }}>
          L'aliment sera disponible dans la recherche
        </div>
      </>
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
