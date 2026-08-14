import React, { forwardRef, useImperativeHandle, useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronDown, PlusCircle, Pencil, Trash2, Apple, Search, X, ArrowUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { SUGAR_FIELDS, FAT_FIELDS, VITAMIN_FIELDS, MINERAL_FIELDS, DETAIL_ONLY_FIELDS, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { FOOD_CATEGORIES, COMPLEMENT_CATEGORY } from '../lib/foodCategories'
import { DEFAULT_SORT, sortAliments, describeSortField, filterByCategories, isCustomSort, isCustomFilter } from '../lib/foodSort'
import { getNutriBadge } from '../lib/nutriBadge'
import { getComplementNutrients } from '../lib/complementNutrients'
import Loader from './Loader'
import EmptyState from './EmptyState'
import FieldLabel from './FieldLabel'
import FoodSortModal from './FoodSortModal'
import MacroPillsRow from './MacroPillsRow'
import BrandCombobox from './BrandCombobox'
import ComplementNutrientPills from './ComplementNutrientPills'

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
  const isComplement = aliment.categorie === COMPLEMENT_CATEGORY
  // Pour un complément, les valeurs sont stockées pour 100g (comme le reste du
  // schéma) mais l'utilisateur les pense "par dose" — on reconvertit pour
  // l'affichage à partir de sa "portion courante" (portions[1] — la dose de
  // base, portions[0], sert uniquement d'unité de saisie, pas d'affichage).
  // Si aucune portion courante n'a été définie, on retombe sur la dose seule.
  // La notion de "100g" n'a pas de sens pour un complément (pas de badge
  // nutritionnel non plus, les seuils /100g ne sont pas pertinents ici).
  const dose = isComplement ? (aliment.portions?.[1] || aliment.portions?.[0]) : null
  const doseScale = dose?.g > 0 ? dose.g / 100 : 1
  const complementNutrients = isComplement ? getComplementNutrients(aliment, doseScale) : null

  // "Portion recommandée" = 1ère entrée des "Portions courantes" définies sur
  // l'aliment (pas de notion de portion unique en base, on prend la première).
  const portion = !isComplement ? aliment.portions?.[0] : null
  const portionScale = portion?.g > 0 ? portion.g / 100 : null

  const badge = !isComplement ? getNutriBadge(aliment) : null

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {aliment.nom}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button className="btn-icon" onClick={() => onEdit(aliment)}      style={{ color: 'var(--text-hint)' }}><Pencil size={16} /></button>
          <button className="btn-icon" onClick={() => onDelete(aliment.id)} style={{ color: 'var(--text-hint)' }}><Trash2 size={16} /></button>
        </div>
      </div>

      {/* ── Compléments : dose + marque + vitamines/minéraux en %AJR sur une même ligne ── */}
      {isComplement ? (
        <>
          {(dose?.label || aliment.marque || complementNutrients.length > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {dose?.label && (
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--green-dark)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {dose.label}
                </span>
              )}
              {aliment.marque && (
                <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
                  {aliment.marque}
                </span>
              )}
              <ComplementNutrientPills nutrients={complementNutrients} />
            </div>
          )}
          {complementNutrients.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: (dose?.label || aliment.marque) ? 6 : 0 }}>Aucune vitamine ou minéral renseigné</div>
          )}
        </>
      ) : (
        <>
          {/* ── Chips marque / badge nutritionnel ── */}
          {(aliment.marque || badge) && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {aliment.marque && (
                <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
                  {aliment.marque}
                </span>
              )}
              {badge && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: badge.bg, color: badge.color, borderRadius: 20, padding: '2px 9px 2px 7px', fontSize: 10.5, fontWeight: 700 }}>
                  {badge.emoji} {badge.label}
                </span>
              )}
            </div>
          )}
          <MacroPillsRow
            label="100 g" labelColor="var(--text-hint)" bg="var(--gray-bg)"
            kcal={aliment.energie_kcal || 0} kcalColor="var(--text)"
            proteines={aliment.proteines || 0} glucides={aliment.glucides || 0} lipides={aliment.lipides || 0}
            marginBottom={portionScale != null ? 6 : 0}
          />
          {portionScale != null && (
            <MacroPillsRow
              label="Portion" labelColor="var(--green-dark)" bg="var(--green-light)"
              kcal={(aliment.energie_kcal || 0) * portionScale} kcalColor="var(--green-dark)"
              proteines={(aliment.proteines || 0) * portionScale} glucides={(aliment.glucides || 0) * portionScale} lipides={(aliment.lipides || 0) * portionScale}
              hint={portion.label}
            />
          )}
        </>
      )}
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

  // Portions courantes des compléments — exprimées en nombre de doses (ex: "2"
  // pour "2 gélules") plutôt qu'en grammes, puisque l'utilisateur pense en
  // nombre de prises et pas en poids. Converties en {label, g} à la sauvegarde
  // (voir save()) à partir de la dose de base ci-dessous.
  const [complementPortions, setComplementPortions] = useState([])

  // Marques connues de l'utilisateur, pour le menu déroulant du champ marque
  // (table `marques` — voir BrandCombobox). Rechargées avec les aliments.
  const [marques, setMarques] = useState([])

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

  // Nom (singulier, sans "1 ") de l'unité de dose courante, pour composer les
  // libellés "N gélules" des portions courantes.
  const doseNoun = () => (
    doseTypeKey === 'autre'
      ? (doseLabel.trim() || 'dose').replace(/^1\s+/, '')
      : DOSE_TYPES.find(d => d.key === doseTypeKey).label.toLowerCase()
  )

  const pluralizeWord = (word, n) => (n === 1 || /[sx]$/i.test(word) ? word : `${word}s`)

  // Libellé auto d'une portion complément exprimée en nombre de doses (ex: 2 → "2 gélules").
  const doseUnitLabel = (n) => {
    if (doseTypeKey === 'ml') return `${n} ${doseNoun()}` // "ml" ne se pluralise pas
    const words = doseNoun().split(' ')
    words[0] = pluralizeWord(words[0], n)
    return `${n} ${words.join(' ')}`
  }

  const addComplementPortion    = () => setComplementPortions(p => [...p, ''])
  const removeComplementPortion = (i) => setComplementPortions(p => p.filter((_, idx) => idx !== i))
  const updateComplementPortion = (i, v) => setComplementPortions(p => p.map((x, idx) => idx === i ? v : x))

  // ── Recherche + tri/filtre + regroupement par catégorie (liste) ──────────
  const [foodSearch, setFoodSearch]     = useState('')
  const [foodSort,   setFoodSort]       = useState(DEFAULT_SORT)
  const [sortModalOpen, setSortModalOpen] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set())

  const foodSortActive   = isCustomSort(foodSort)
  const foodFilterActive = isCustomFilter(foodSort)

  // Normalise pour une recherche insensible à la casse et aux accents
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  const filteredAliments = useMemo(() => {
    const q = normalize(foodSearch.trim())
    if (!q) return aliments
    return aliments.filter(a => normalize(a.nom).includes(q) || normalize(a.marque || '').includes(q))
  }, [aliments, foodSearch])

  // Regroupés par catégorie, dans l'ordre de FOOD_CATEGORIES, puis les
  // catégories "historiques" hors liste (anciens aliments en texte libre,
  // saisis avant que la catégorie devienne un menu déroulant), par ordre alpha.
  const groupedAliments = useMemo(() => {
    const categoryFiltered = filterByCategories(filteredAliments, foodSort.categories)
    const sorted = sortAliments(categoryFiltered, foodSort)
    const groups = []
    const seen = new Set()
    for (const cat of FOOD_CATEGORIES) {
      seen.add(cat)
      if (foodSort.categories.length > 0 && !foodSort.categories.includes(cat)) continue
      const items = sorted.filter(a => (a.categorie || 'Personnalisé') === cat)
      if (items.length > 0) groups.push({ key: cat, items })
    }
    const extraCats = [...new Set(sorted.map(a => a.categorie || 'Personnalisé').filter(c => !seen.has(c)))].sort((a, b) => a.localeCompare(b, 'fr'))
    for (const cat of extraCats) {
      if (foodSort.categories.length > 0 && !foodSort.categories.includes(cat)) continue
      const items = sorted.filter(a => (a.categorie || 'Personnalisé') === cat)
      if (items.length > 0) groups.push({ key: cat, items })
    }
    return groups
  }, [filteredAliments, foodSort])

  const totalFilteredCount = groupedAliments.reduce((s, g) => s + g.items.length, 0)

  const toggleCategoryCollapsed = (key) =>
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  useEffect(() => { load() }, [user])

  useEffect(() => { onFormOpenChange?.(view === 'form') }, [view])

  const load = async () => {
    if (!user) { setAliments([]); setMarques([]); setLoading(false); return }
    setLoading(true)
    const [{ data: alimentsData }, { data: marquesData }] = await Promise.all([
      supabase.from('aliments_custom').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('marques').select('nom').eq('user_id', user.id).order('nom'),
    ])
    setAliments(alimentsData || [])
    setMarques((marquesData || []).map(m => m.nom))
    setLoading(false)
  }

  // Enregistre la marque saisie si elle est nouvelle, pour qu'elle réapparaisse
  // dans le menu déroulant sans avoir à la retaper la prochaine fois.
  const ensureMarque = async (nom) => {
    if (!nom || marques.some(m => m.toLowerCase() === nom.toLowerCase())) return
    const { error } = await supabase.from('marques').upsert([{ nom, user_id: user.id }], { onConflict: 'user_id,nom', ignoreDuplicates: true })
    if (!error) setMarques(m => [...m, nom].sort((a, b) => a.localeCompare(b, 'fr')))
  }

  const set           = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setExtraField = (k, v) => setExtra(e => ({ ...e, [k]: v }))
  const addPortion    = () => setPortions(p => [...p, { label: '', g: '' }])
  const removePortion = (i) => setPortions(p => p.filter((_, idx) => idx !== i))
  const updatePortion = (i, k, v) => setPortions(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

  const resetForm = () => {
    setForm(EMPTY_FORM); setExtra({}); setPortions([{ label: '', g: '' }]); setEditingId(null)
    setDoseType(DOSE_TYPES[0].key); setDoseLabel(''); setComplementPortions([])
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
      // Portions courantes = toutes les entrées après la dose de base (portions[0]),
      // reconverties en nombre de doses pour l'affichage.
      const extraPortions = Array.isArray(aliment.portions) ? aliment.portions.slice(1) : []
      setComplementPortions(extraPortions.map(p => String(round(p.g / doseW))))
    } else {
      setDoseType(DOSE_TYPES[0].key); setDoseLabel(''); setComplementPortions([])
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
      ? [
          { label: resolveDoseLabel(), g: doseW },
          ...complementPortions
            .map(c => parseFloat(c))
            .filter(c => c > 0)
            .map(c => ({ label: doseUnitLabel(c), g: round(c * doseW) })),
        ]
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
    if (payload.marque) await ensureMarque(payload.marque)
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
                <BrandCombobox value={form.marque} onChange={v => set('marque', v)} options={marques} />
              </div>
              <div>
                <FieldLabel>Catégorie</FieldLabel>
                <select className="input" value={form.categorie} onChange={e => set('categorie', e.target.value)}>
                  {(FOOD_CATEGORIES.includes(form.categorie) ? FOOD_CATEGORIES : [form.categorie, ...FOOD_CATEGORIES]).map(c => (
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

        {/* ── Portions courantes — pour les compléments, exprimées en nombre de
              doses (ex: "2" → "2 gélules") plutôt qu'en grammes, en plus de la
              dose de base définie plus haut. ── */}
        <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Portions courantes</div>
            <button
              onClick={isComplement ? addComplementPortion : addPortion}
              style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <PlusCircle size={14} /> Ajouter
            </button>
          </div>

          {isComplement ? (
            complementPortions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                Optionnel — en plus de la dose ci-dessus, ajoute une quantité que tu prends parfois (ex : 2 gélules).
              </div>
            ) : complementPortions.map((count, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="2"
                  value={count}
                  onChange={e => updateComplementPortion(i, e.target.value)}
                  style={{ width: 70 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {parseFloat(count) > 0 ? `× ${doseNoun()} → ${doseUnitLabel(parseFloat(count))}` : `× ${doseNoun()}`}
                </span>
                <button onClick={() => removeComplementPortion(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
            ))
          ) : (
            portions.map((p, i) => (
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
            ))
          )}
        </div>

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
      {aliments.length > 0 && (
        <>
          {/* ── Barre de recherche + tri ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder="Rechercher un aliment..."
                value={foodSearch}
                onChange={e => setFoodSearch(e.target.value)}
                style={{ paddingLeft: 36, paddingRight: foodSearch ? 36 : 12 }}
              />
              {foodSearch && (
                <button
                  onClick={() => setFoodSearch('')}
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
                background: (foodSortActive || foodFilterActive) ? 'var(--green-light)' : 'var(--gray-bg)',
                color: (foodSortActive || foodFilterActive) ? 'var(--green-dark)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <ArrowUpDown size={17} />
            </button>
          </div>

          {(foodSortActive || foodFilterActive) && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 10 }}>
              {foodFilterActive && `Filtré par ${foodSort.categories.join(', ')}`}
              {foodFilterActive && foodSortActive && ' · '}
              {foodSortActive && `Trié par ${describeSortField(foodSort.primary)}${foodSort.secondary ? `, puis ${describeSortField(foodSort.secondary)}` : ''}`}
            </div>
          )}
        </>
      )}

      {loading && <Loader />}

      {!loading && aliments.length === 0 && (
        <EmptyState icon={<Apple size={40} />} title="Aucun aliment personnalisé" description="Ajoute un aliment qui n'existe pas dans Ciqual" />
      )}

      {!loading && aliments.length > 0 && totalFilteredCount === 0 && (
        <EmptyState
          icon={<Apple size={40} />}
          title="Aucun résultat"
          description="Aucun aliment ne correspond à ta recherche/filtre"
        />
      )}

      {groupedAliments.map(({ key, items }) => {
        const collapsed = collapsedCategories.has(key)
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            <button
              onClick={() => toggleCategoryCollapsed(key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: collapsed ? 0 : 6 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {key} <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>({items.length})</span>
              </span>
              <ChevronDown size={16} color="var(--text-hint)" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {!collapsed && items.map(a => (
              <FoodCard key={a.id} aliment={a} onEdit={startEdit} onDelete={handleDelete} />
            ))}
          </div>
        )
      })}

      {/* ── Tri des aliments ── */}
      {sortModalOpen && (
        <FoodSortModal
          value={foodSort}
          onChange={setFoodSort}
          onClose={() => setSortModalOpen(false)}
        />
      )}
    </>
  )
})

export default CustomFoodsSection
