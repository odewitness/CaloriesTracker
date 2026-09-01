import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Wand2, RefreshCw, ChevronLeft, Plus, Trash2, AlertTriangle, CalendarPlus, Check, ShoppingCart, ChefHat, Lock, LockOpen, Pin, ChevronDown, Save, FolderOpen, Pencil } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useMealPlanner } from '../hooks/useMealPlanner'
import { useMealPlans } from '../hooks/useMealPlans'
import { useShoppingLists, useShoppingListItems } from '../hooks/useShoppingLists'
import { useBatchCooking } from '../hooks/useBatchCooking'
import { useToast } from '../lib/toast'
import { deviationLevel, batchSummary, slotGroupKey, buildVivier } from '../lib/mealPlanner'
import { addDaysStr, stashAppliedPlan, removeAppliedPlan } from '../lib/mealPlannerApply'
import { mondayOf } from '../lib/dates'
import { SEASONS, getSeasonIcon } from '../lib/seasons'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// MealPlannerModal — chantier « Planificateur automatique de repas de la
// semaine » (voir docs/planificateur-repas.md). Entrée depuis la vue « Menus »
// du calendrier.
//
// PALIER 1 : configuration → génération → aperçu 3 niveaux (repas / jour /
// semaine) avec feu tricolore d'écart aux cibles + régénération. L'application
// au calendrier et l'ajout à la liste de courses sont l'incrément suivant.
//
// Props :
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_COLOR = { ok: 'var(--green)', warn: 'var(--amber)', off: 'var(--coral)' }
const MACRO_ROWS = [
  { key: 'kcal', label: 'kcal', unit: '' },
  { key: 'prot', label: 'Protéines', unit: 'g' },
  { key: 'gluc', label: 'Glucides', unit: 'g' },
  { key: 'lip', label: 'Lipides', unit: 'g' },
  { key: 'fibres', label: 'Fibres', unit: 'g' },
]

function r0(n) { return Math.round(n || 0) }

// "lun. 8 sept."
function dayChipLabel(startStr, dayIndex) {
  const d = new Date(addDaysStr(startStr, dayIndex) + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// "du lun. 8 au dim. 14 sept."
function rangeLabel(startStr, days) {
  if (!startStr || days < 1) return ''
  const a = new Date(startStr + 'T12:00:00')
  const b = new Date(addDaysStr(startStr, days - 1) + 'T12:00:00')
  const fa = a.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', ...(a.getMonth() === b.getMonth() ? {} : { month: 'short' }) })
  const fb = b.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return days === 1 ? `le ${fb}` : `du ${fa} au ${fb}`
}

// Puce valeur/cible colorée par l'écart.
function MacroChip({ label, value, target, unit }) {
  const level = deviationLevel(value, target)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 58 }}>
      <span style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: LEVEL_COLOR[level] }}>
        {r0(value)}{unit}
      </span>
      {target > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>/ {r0(target)}{unit}</span>
      )}
    </div>
  )
}

function MacroRow({ totals, target }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {MACRO_ROWS.map(m => (
        <MacroChip key={m.key} label={m.label === 'kcal' ? 'kcal' : m.label.slice(0, 4)} value={totals[m.key]} target={target[m.key]} unit={m.unit} />
      ))}
    </div>
  )
}

// Sélecteur de recettes imposées pour une brique (slot.pinnedIds). Une recette
// imposée est forcément dans le pool de sa catégorie à la génération, et n'est
// jamais remplacée par la recherche locale ni par « Régénérer ».
function PinPicker({ options, pinnedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const pinned = new Set(pinnedIds || [])
  const toggle = (id) => {
    const next = new Set(pinned)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange([...next])
  }
  const count = pinned.size
  return (
    <div style={{ marginTop: 2 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: count ? 'var(--green-dark)' : 'var(--text-hint)', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: '2px 0' }}
      >
        <Pin size={11} />
        {count ? `${count} recette${count > 1 ? 's' : ''} imposée${count > 1 ? 's' : ''}` : 'Imposer une recette'}
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {count > 0 && !open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {[...pinned].map(id => {
            const o = options.find(x => x.id === id)
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--green-dark)', background: 'var(--green-light)', border: 'none', borderRadius: 6, padding: '3px 7px', fontFamily: 'var(--font)' }}
              >
                {o?.nom || 'recette supprimée'} <X size={10} />
              </button>
            )
          })}
        </div>
      )}
      {open && (
        <div style={{ maxHeight: 168, overflowY: 'auto', margin: '4px 0 2px', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px' }}>
          {options.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', padding: '4px 2px' }}>
              Aucune recette dans cette catégorie.
            </div>
          ) : options.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '4px 2px', cursor: 'pointer' }}>
              <input type="checkbox" checked={pinned.has(o.id)} onChange={() => toggle(o.id)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.nom}
                {o.kind === 'repas_type' && <span style={{ color: 'var(--text-hint)' }}> · repas type</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Éditeur de composition d'un repas ──────────────────────────────────────
function MealSlotsEditor({ meal, slots, included, onToggleIncluded, onChange, pinOptionsFor }) {
  const setSlot = (i, patch) => onChange(slots.map((s, si) => si === i ? { ...s, ...patch } : s))
  const removeSlot = (i) => onChange(slots.filter((_, si) => si !== i))
  const addSlot = () => onChange([...slots, { categorie: 'Plat', nbDifferentes: 2 }])

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 8, opacity: included ? 1 : 0.55 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, marginBottom: included ? 6 : 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={included} onChange={onToggleIncluded} />
        {meal}
        {!included && <span style={{ fontWeight: 500, color: 'var(--text-hint)', fontSize: 11 }}>— pas dans ce plan</span>}
      </label>
      {included && (
        <>
          {slots.map((slot, i) => {
            const pinCount = (slot.pinnedIds || []).length
            return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  className="input"
                  value={slot.categorie}
                  onChange={e => setSlot(i, { categorie: e.target.value, pinnedIds: [] })}
                  style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
                >
                  {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setSlot(i, { nbDifferentes: Math.max(1, (slot.nbDifferentes || 1) - 1) })} aria-label="Moins">−</button>
                  <span style={{ fontSize: 12.5, fontWeight: 700, width: 46, textAlign: 'center' }} title="recettes différentes sur la période">
                    {slot.nbDifferentes || 1}×
                  </span>
                  <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => setSlot(i, { nbDifferentes: Math.min(7, (slot.nbDifferentes || 1) + 1) })} aria-label="Plus">+</button>
                </div>
                {slots.length > 1 && (
                  <button className="btn-icon" style={{ width: 26, height: 26, color: 'var(--coral)' }} onClick={() => removeSlot(i)} aria-label="Retirer la brique">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <PinPicker
                options={pinOptionsFor(slot.categorie)}
                pinnedIds={slot.pinnedIds}
                onChange={ids => setSlot(i, { pinnedIds: ids })}
              />
              {pinCount > (slot.nbDifferentes || 1) && (
                <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 2 }}>
                  {pinCount} recettes imposées → au moins {pinCount}× sur la période.
                </div>
              )}
            </div>
          )})}
          <button
            onClick={addSlot}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: '2px 0' }}
          >
            <Plus size={13} /> Ajouter une brique
          </button>
        </>
      )}
    </div>
  )
}

// "8 sept."
function shortDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ── Liste des plans enregistrés (vue configuration) ───────────────────────
function SavedPlansSection({ plans, onLoad, onRename, onDelete }) {
  const [open, setOpen] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  if (!plans.length) return null

  const startEdit = (p) => { setEditingId(p.id); setDraft(p.nom) }
  const commitEdit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim())
    setEditingId(null)
  }

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 16, borderLeft: '3px solid var(--green)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between', background: 'none', border: 'none', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen size={14} color="var(--green-dark)" /> Reprendre un plan enregistré ({plans.length})
        </span>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>
            Touche un plan pour l'ouvrir dans l'aperçu, l'ajuster et l'appliquer à la semaine de ton choix.
          </div>
          {plans.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
              {editingId === p.id ? (
                <input
                  className="input"
                  value={draft}
                  autoFocus
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}
                  style={{ flex: 1, fontSize: 12.5, padding: '5px 8px' }}
                />
              ) : (
                <button
                  onClick={() => onLoad(p.id)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: '2px 0' }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>
                    {(p.plan?.days?.length || 0)} j · modifié le {shortDate((p.updated_at || '').slice(0, 10))}
                  </span>
                </button>
              )}
              <button className="btn-icon" style={{ width: 26, height: 26, color: 'var(--text-hint)', flexShrink: 0 }} onClick={() => startEdit(p)} aria-label="Renommer">
                <Pencil size={12} />
              </button>
              <button className="btn-icon" style={{ width: 26, height: 26, color: 'var(--coral)', flexShrink: 0 }} onClick={() => onDelete(p.id)} aria-label="Supprimer">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Enregistrer le plan courant (vue aperçu) ──────────────────────────────
function SavePlanCard({ savedPlanId, savedPlanName, defaultName, onSave }) {
  const [name, setName] = useState(defaultName)
  const [asNew, setAsNew] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setName(defaultName) }, [defaultName])

  const isUpdate = savedPlanId && !asNew
  const submit = async () => {
    if (busy) return
    setBusy(true)
    await onSave(name, { asNew })
    setBusy(false)
    setAsNew(false)
  }

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
      <SectionLabel>Enregistrer ce plan</SectionLabel>
      {savedPlanId && !asNew ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
          Chargé depuis « <strong style={{ color: 'var(--text)' }}>{savedPlanName}</strong> ».
        </div>
      ) : (
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom du plan"
          style={{ fontSize: 12.5, marginBottom: 8 }}
        />
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={submit}
          disabled={busy || (!isUpdate && !name.trim())}
          className="btn-primary"
          style={{ width: 'auto', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}
        >
          <Save size={15} />
          {busy ? 'Enregistrement…' : isUpdate ? `Mettre à jour « ${savedPlanName} »` : 'Enregistrer'}
        </button>
        {savedPlanId && !asNew && (
          <button
            onClick={() => setAsNew(true)}
            style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--gray-bg)', border: 'none', borderRadius: 8, padding: '0 12px', fontFamily: 'var(--font)' }}
          >
            Nouveau
          </button>
        )}
      </div>
    </div>
  )
}

// ── Vue configuration ─────────────────────────────────────────────────────
function ConfigView({ planner, onGenerate, savedPlans, onLoadPlan, onRenamePlan, onDeletePlan }) {
  const {
    config, mealConfig, baseMealConfig, excludedMeals, setConfig, setMealConfig, toggleMeal,
    recipeCount, templateCount, favoriteCount, recettes, repasTypes,
  } = planner
  const excluded = new Set(excludedMeals)

  // Options d'épinglage par catégorie : toutes les recettes (+ repas types si
  // l'option est active) de la catégorie, sans filtre saison/temps — une
  // recette imposée l'emporte même hors saison. Mémoïsé par catégorie.
  const pinOptionsCache = useMemo(() => new Map(), [recettes, repasTypes, config.includeRepasTypes])
  const pinOptionsFor = (categorie) => {
    if (pinOptionsCache.has(categorie)) return pinOptionsCache.get(categorie)
    const list = buildVivier(categorie, {
      recettes, repasTypes, season: null, seasonMode: 'bonus',
      includeRepasTypes: config.includeRepasTypes !== false,
    })
      .map(c => ({ id: c.id, nom: c.nom, kind: c.kind }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    pinOptionsCache.set(categorie, list)
    return list
  }

  // Change les slots d'un repas ET synchronise « N× » + recettes imposées entre
  // tous les slots qui partagent la même clé de groupe (ex. « Plat » au déjeuner
  // et au dîner — un seul vivier, un seul pool).
  const changeMealSlots = (meal, nextSlots) => setMealConfig(mc => {
    const updated = { ...mc, [meal]: nextSlots }
    const byKey = {}
    for (const s of nextSlots) byKey[slotGroupKey(s)] = { nbDifferentes: s.nbDifferentes, pinnedIds: s.pinnedIds }
    for (const [mn, slots] of Object.entries(updated)) {
      updated[mn] = slots.map(s => {
        const shared = byKey[slotGroupKey(s)]
        return shared ? { ...s, nbDifferentes: shared.nbDifferentes, pinnedIds: shared.pinnedIds } : s
      })
    }
    return updated
  })

  return (
    <>
      <SavedPlansSection
        plans={savedPlans}
        onLoad={onLoadPlan}
        onRename={onRenamePlan}
        onDelete={onDeletePlan}
      />

      {/* Jours */}
      <SectionLabel>Nombre de jours</SectionLabel>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <button key={n} onClick={() => setConfig({ days: n })} style={segBtn(config.days === n)}>{n}</button>
        ))}
      </div>

      {/* Jour de début */}
      <SectionLabel>À partir du</SectionLabel>
      <input
        type="date"
        className="input"
        value={config.startDateStr}
        onChange={e => setConfig({ startDateStr: e.target.value })}
        style={{ marginBottom: 4, fontSize: 13 }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>
        {rangeLabel(config.startDateStr, config.days)}
      </div>

      <Collapsible label="Options avancées">
        {/* Personnes */}
        <SectionLabel>Personnes</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button className="btn-icon" onClick={() => setConfig({ people: Math.max(1, config.people - 1) })} aria-label="Moins">−</button>
          <span style={{ fontSize: 15, fontWeight: 700, width: 24, textAlign: 'center' }}>{config.people}</span>
          <button className="btn-icon" onClick={() => setConfig({ people: Math.min(12, config.people + 1) })} aria-label="Plus">+</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 16 }}>Pour les quantités de la liste de courses.</div>

        {/* Saison */}
        <SectionLabel>Saison</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
          {SEASONS.map(s => (
            <button key={s} onClick={() => setConfig({ season: config.season === s ? null : s })} style={segBtn(config.season === s)}>
              {getSeasonIcon(s)} {s}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={config.seasonMode === 'filter'}
            onChange={e => setConfig({ seasonMode: e.target.checked ? 'filter' : 'bonus' })}
            disabled={!config.season}
          />
          Saison stricte
        </label>

        {/* Temps de cuisine */}
        <SectionLabel>Temps de cuisine max</SectionLabel>
        <div style={{ display: 'flex', gap: 5, marginBottom: 18, flexWrap: 'wrap' }}>
          {[null, 15, 30, 45, 60].map(v => (
            <button
              key={v ?? 'any'}
              onClick={() => setConfig({ maxCookMinutes: v })}
              style={segBtn((config.maxCookMinutes ?? null) === v)}
            >
              {v == null ? 'Peu importe' : `≤ ${v} min`}
            </button>
          ))}
        </div>

        {/* Bascules */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          <input type="checkbox" checked={config.includeRepasTypes !== false} onChange={e => setConfig({ includeRepasTypes: e.target.checked })} />
          Aussi mes repas types
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          <input type="checkbox" checked={config.fillMicros !== false} onChange={e => setConfig({ fillMicros: e.target.checked })} />
          Compléter vitamines &amp; minéraux
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          <input type="checkbox" checked={config.allowDoublePortions !== false} onChange={e => setConfig({ allowDoublePortions: e.target.checked })} />
          2 portions d'un même plat si utile
        </label>

        {/* Composition des repas */}
        <SectionLabel>Repas &amp; composition</SectionLabel>
        {Object.keys(baseMealConfig).length === 0 && (
          <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-hint)', textAlign: 'center', marginBottom: 8 }}>
            Aucun repas activé. Active des repas depuis Profil.
          </div>
        )}
        {Object.entries(baseMealConfig).map(([meal, slots]) => (
          <MealSlotsEditor
            key={meal}
            meal={meal}
            slots={slots}
            included={!excluded.has(meal)}
            onToggleIncluded={() => toggleMeal(meal)}
            onChange={next => changeMealSlots(meal, next)}
            pinOptionsFor={pinOptionsFor}
          />
        ))}
      </Collapsible>

      <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '0 0 12px' }}>
        {recipeCount} recette{recipeCount > 1 ? 's' : ''} · {templateCount} repas type{templateCount > 1 ? 's' : ''} · {favoriteCount} favori{favoriteCount > 1 ? 's' : ''}
      </div>

      <button
        className="btn-primary"
        onClick={onGenerate}
        disabled={Object.keys(mealConfig).length === 0}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: Object.keys(mealConfig).length === 0 ? 0.5 : 1 }}
      >
        <Wand2 size={16} /> Générer le plan
      </button>
    </>
  )
}

// Panneau d'édition d'une brique / d'un aliment « en + » dans l'aperçu.
function ItemEditor({ item, candidates, onSwap, onRemove, onSetPortions }) {
  const isAddon = item.kind === 'ajout'
  const portions = item.portions || 1
  return (
    <div style={{ background: 'var(--gray-bg)', borderRadius: 6, padding: '6px 8px', margin: '2px 0 6px' }}>
      {!isAddon && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 6px' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Portions
            </span>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => onSetPortions(portions - 1)} disabled={portions <= 1} aria-label="Moins de portions">−</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, width: 16, textAlign: 'center' }}>{portions}</span>
            <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => onSetPortions(portions + 1)} disabled={portions >= 2} aria-label="Plus de portions">+</button>
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.3, margin: '2px 0 4px' }}>
            Remplacer par
          </div>
          {candidates.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--text-hint)', padding: '2px 0 6px' }}>
              Aucune autre recette disponible dans cette catégorie.
            </div>
          ) : (
            <div style={{ maxHeight: 148, overflowY: 'auto', margin: '0 -2px 4px' }}>
              {candidates.map(c => (
                <button
                  key={c.id}
                  onClick={() => onSwap(c.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '6px 6px', borderRadius: 5, background: 'var(--white)', border: 'none', fontFamily: 'var(--font)', marginBottom: 2, color: 'var(--text)' }}
                >
                  {c.nom}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button
        onClick={onRemove}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: '4px 2px' }}
      >
        <Trash2 size={12} /> Retirer {isAddon ? 'cet aliment' : 'cette recette'}
      </button>
    </div>
  )
}

// Sélecteur de liste de courses cible : choisir une liste existante OU en
// créer une nouvelle sans quitter le planificateur. Repli automatique sur la
// création quand aucune liste n'existe encore.
function ShoppingListPicker({ lists, valueId, onChange, onCreate, creating }) {
  const [mode, setMode] = useState(lists.length ? 'pick' : 'new')
  const [name, setName] = useState('')
  useEffect(() => { if (!lists.length) setMode('new') }, [lists.length])

  const submit = async () => {
    if (creating) return
    const created = await onCreate(name)
    if (created) { setName(''); setMode('pick') }
  }

  if (mode === 'new') {
    return (
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            placeholder="Nom de la nouvelle liste"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
            autoFocus
          />
          <button
            onClick={submit}
            disabled={creating}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--green-dark)', background: 'var(--green-light)', border: 'none', borderRadius: 8, padding: '6px 12px', fontFamily: 'var(--font)', opacity: creating ? 0.6 : 1 }}
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
        </div>
        {lists.length > 0 && (
          <button
            onClick={() => setMode('pick')}
            style={{ marginTop: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
          >
            ← Choisir une liste existante
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
      <select
        className="input"
        value={valueId || ''}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
      >
        {lists.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
      </select>
      <button
        onClick={() => setMode('new')}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', background: 'var(--green-light)', border: 'none', borderRadius: 8, padding: '6px 10px', fontFamily: 'var(--font)' }}
      >
        <Plus size={13} /> Nouvelle
      </button>
    </div>
  )
}

// ── Vue aperçu ────────────────────────────────────────────────────────────
function PreviewView({
  plan, startDateStr, recettesById, templatesById, people,
  onBack, onRegenerate, generating, onApply, applying, result, applied,
  lockedKeys, onToggleLock, onToggleLockDay,
  swapCandidates, onSwapItem, onRemoveItem, onSetItemPortions,
  onAddToBatch, batchState,
  savedPlanId, savedPlanName, defaultPlanName, onSavePlan, replacing,
}) {
  const [allowConflicts, setAllowConflicts] = useState(false)
  const [editing, setEditing] = useState(null) // { di, meal, ii } | null
  const [macroOpen, setMacroOpen] = useState(() => new Set()) // 'week' | `d${di}` dépliés
  const toggleMacro = (k) => setMacroOpen(s => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n
  })
  useEffect(() => { setEditing(null) }, [plan])
  const batches = useMemo(
    () => batchSummary(plan, { recettesById, templatesById }),
    [plan, recettesById, templatesById],
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}>
          <ChevronLeft size={15} /> Réglages
        </button>
        <button
          onClick={onRegenerate}
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--green-dark)', background: 'var(--green-light)', border: 'none', borderRadius: 8, padding: '7px 12px', fontFamily: 'var(--font)' }}
        >
          <RefreshCw size={13} /> Régénérer
        </button>
      </div>

      {plan.warnings?.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 12, background: 'var(--amber-light)', border: 'none' }}>
          {plan.warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--amber)', fontWeight: 600, marginBottom: i < plan.warnings.length - 1 ? 4 : 0 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Niveau 3 : semaine — compact, détail P/G/L/fibres au tap */}
      {(() => {
        const n = plan.days.length
        const perDay = n ? plan.weekTotals.kcal / n : 0
        const perDayTarget = n ? plan.weekTarget.kcal / n : 0
        const open = macroOpen.has('week')
        return (
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--green)' }}>
            <button
              onClick={() => toggleMacro('week')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8, background: 'none', border: 'none', fontFamily: 'var(--font)', padding: 0 }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Sur {n} jour{n > 1 ? 's' : ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <KcalPill kcal={perDay} target={perDayTarget} />
                <span style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 600 }}>/j</span>
                <ChevronDown size={14} style={{ color: 'var(--text-hint)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </span>
            </button>
            {open && <div style={{ marginTop: 10 }}><MacroRow totals={plan.weekTotals} target={plan.weekTarget} /></div>}
          </div>
        )
      })()}

      {/* Niveau 2 & 1 : jour puis repas */}
      {plan.days.map((day, di) => {
        const dayMealNames = day.meals.map(m => m.meal)
        const dayAllLocked = dayMealNames.length > 0 && dayMealNames.every(m => lockedKeys?.has(`${di}|${m}`))
        const dayMacrosOpen = macroOpen.has(`d${di}`)
        return (
        <div key={di} className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => toggleMacro(`d${di}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: 'none', border: 'none', fontFamily: 'var(--font)', padding: 0, textAlign: 'left' }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{dayChipLabel(startDateStr, di)}</span>
              <KcalPill kcal={day.totals.kcal} target={day.target.kcal} />
              <ChevronDown size={13} style={{ color: 'var(--text-hint)', flexShrink: 0, transform: dayMacrosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            <button
              onClick={() => onToggleLockDay(di, dayMealNames)}
              className="btn-icon"
              aria-label={dayAllLocked ? 'Déverrouiller la journée' : 'Verrouiller la journée'}
              style={{ width: 26, height: 26, flexShrink: 0, color: dayAllLocked ? 'var(--green-dark)' : 'var(--text-hint)' }}
            >
              {dayAllLocked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
          </div>
          {dayMacrosOpen && (
            <div style={{ margin: '8px 0 2px' }}>
              <MacroRow totals={day.totals} target={day.target} />
            </div>
          )}

          {day.meals.map((m, mi) => {
            const mealLocked = lockedKeys?.has(`${di}|${m.meal}`)
            return (
            <div key={mi} style={{ borderTop: '1px solid var(--border)', paddingTop: 7, marginTop: 7, background: mealLocked ? 'var(--green-light)' : undefined, borderRadius: mealLocked ? 6 : 0, marginLeft: mealLocked ? -6 : 0, marginRight: mealLocked ? -6 : 0, padding: mealLocked ? '7px 6px 4px' : '7px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                  <button
                    onClick={() => onToggleLock(di, m.meal)}
                    aria-label={mealLocked ? `Déverrouiller ${m.meal}` : `Verrouiller ${m.meal}`}
                    style={{ display: 'flex', background: 'none', border: 'none', padding: 0, color: mealLocked ? 'var(--green-dark)' : 'var(--text-hint)' }}
                  >
                    {mealLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </button>
                  {m.meal}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: LEVEL_COLOR[deviationLevel(m.totals.kcal, m.target.kcal)] }}>
                  {r0(m.totals.kcal)} / {r0(m.target.kcal)} kcal
                </span>
              </div>
              {m.items.map((it, ii) => {
                const isOpen = editing && editing.di === di && editing.meal === m.meal && editing.ii === ii
                return (
                <div key={ii}>
                  <button
                    onClick={() => setEditing(isOpen ? null : { di, meal: m.meal, ii })}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                      fontSize: 12, padding: '3px 4px', borderRadius: 5, gap: 8,
                      background: isOpen ? 'var(--gray-bg)' : 'none', border: 'none', fontFamily: 'var(--font)',
                      color: it.kind === 'ajout' ? 'var(--green-dark)' : 'var(--text)', textAlign: 'left',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.kind === 'ajout' ? '+ ' : ''}{it.nom}
                      {it.kind === 'ajout' && <span style={{ color: 'var(--text-hint)' }}> · {r0(it.qty_g)} g</span>}
                      {it.micro && <span style={{ color: 'var(--text-hint)' }}> · {String(it.micro).toLowerCase()}</span>}
                      {it.kind === 'recette' && it.portionG && <span style={{ color: 'var(--text-hint)' }}> · {it.portions || 1} portion{(it.portions || 1) > 1 ? 's' : ''}</span>}
                      {it.kind === 'repas_type' && <span style={{ color: 'var(--text-hint)' }}> · {it.portions || 1} part{(it.portions || 1) > 1 ? 's' : ''}</span>}
                    </span>
                    <span style={{ color: 'var(--text-hint)', flexShrink: 0 }}>{r0(it.macros.kcal)} kcal</span>
                  </button>
                  {isOpen && (
                    <ItemEditor
                      item={it}
                      candidates={it.kind === 'ajout' ? [] : swapCandidates(di, m.meal, ii)}
                      onSwap={(cid) => { onSwapItem(di, m.meal, ii, cid); setEditing(null) }}
                      onRemove={() => { onRemoveItem(di, m.meal, ii); setEditing(null) }}
                      onSetPortions={(n) => onSetItemPortions(di, m.meal, ii, n)}
                    />
                  )}
                </div>
              )})}
            </div>
          )})}
        </div>
      )})}

      {/* Batch cooking : quoi préparer, en quelle quantité */}
      {batches.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ChefHat size={14} color="var(--green-dark)" />
            <SectionLabel>À préparer</SectionLabel>
          </div>
          {batches.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nom}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {b.portionsNeeded} portion{b.portionsNeeded > 1 ? 's' : ''}
              </span>
            </div>
          ))}
          {people > 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 5 }}>
              Quantités pour 1 personne. Pour {people}, multiplie par {people}.
            </div>
          )}
          {batches.some(b => b.kind === 'recette') && (
            <button
              onClick={onAddToBatch}
              disabled={batchState === 'busy' || batchState === 'done'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                background: 'none', border: 'none', color: 'var(--green-dark)',
                opacity: batchState === 'busy' ? 0.6 : 1,
              }}
            >
              <ChefHat size={13} />
              {batchState === 'busy' ? 'Envoi…'
                : batchState === 'done' ? '✓ Ajouté à Ma fournée'
                : 'Ajouter à Ma fournée'}
            </button>
          )}
        </div>
      )}

      <SavePlanCard
        savedPlanId={savedPlanId}
        savedPlanName={savedPlanName}
        defaultName={defaultPlanName}
        onSave={onSavePlan}
      />

      {/* Appliquer au calendrier */}
      {result?.inserted > 0 ? (
        <div className="card" style={{ padding: '14px', marginTop: 4, background: 'var(--green-light)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 6 }}>
            <Check size={15} /> {result.inserted} repas ajouté{result.inserted > 1 ? 's' : ''} au calendrier
          </div>
          {result.skippedConflict?.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {result.skippedConflict.length} créneau{result.skippedConflict.length > 1 ? 'x' : ''} déjà occupé{result.skippedConflict.length > 1 ? 's' : ''} — ignoré{result.skippedConflict.length > 1 ? 's' : ''}.
            </div>
          )}
          {result.skippedExcluded?.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {result.skippedExcluded.length} jour{result.skippedExcluded.length > 1 ? 's' : ''} exclu{result.skippedExcluded.length > 1 ? 's' : ''} — sauté{result.skippedExcluded.length > 1 ? 's' : ''}.
            </div>
          )}

          {/* Liste de courses */}
          <div style={{ marginTop: 10 }}>
            <ShoppingListPicker
              lists={applied.shoppingLists}
              valueId={applied.shoppingListId}
              onChange={applied.setShoppingListId}
              onCreate={applied.onCreateList}
              creating={applied.creatingList}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
              <input
                type="checkbox"
                checked={applied.clearListFirst}
                onChange={e => applied.setClearListFirst(e.target.checked)}
              />
              Vider cette liste avant d'ajouter (repartir à neuf)
            </label>
            <button
              className="btn-primary"
              onClick={applied.onGenerateShopping}
              disabled={applied.shoppingState === 'busy' || !applied.shoppingListId || applied.shoppingState === 'done'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!applied.shoppingListId || applied.shoppingState === 'done') ? 0.6 : 1 }}
            >
              <ShoppingCart size={15} />
              {applied.shoppingState === 'busy' ? 'Ajout…'
                : applied.shoppingState === 'done' ? '✓ Ajouté à la liste'
                : applied.clearListFirst ? 'Régénérer la liste de courses' : 'Générer la liste de courses'}
            </button>
          </div>

          {/* Retirer tout le plan */}
          <button
            onClick={applied.onRemovePlan}
            disabled={applied.removing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
          >
            <Trash2 size={13} /> {applied.removing ? 'Retrait…' : 'Retirer tout le plan du calendrier'}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '12px 14px', marginTop: 4 }}>
          <SectionLabel>{replacing ? 'Remplacer le plan de la semaine' : 'Appliquer au calendrier'}</SectionLabel>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
            {rangeLabel(startDateStr, plan.days.length)}
            <button
              onClick={onBack}
              style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--green-dark)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
            >
              changer
            </button>
          </div>
          {!replacing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
              <input type="checkbox" checked={allowConflicts} onChange={e => setAllowConflicts(e.target.checked)} />
              Ajouter même si un repas est déjà prévu sur le créneau
            </label>
          )}
          <button
            className="btn-primary"
            onClick={() => onApply({ startDateStr, conflictStrategy: allowConflicts ? 'add' : 'skip' })}
            disabled={applying}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: applying ? 0.5 : 1 }}
          >
            <CalendarPlus size={16} /> {applying ? 'Ajout…' : replacing ? 'Remplacer le plan' : 'Appliquer au calendrier'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
            {replacing
              ? "L'ancien plan de la semaine est retiré ; tes repas ajoutés à la main restent."
              : "Un repas prévu par créneau. Rien n'est écrasé."}
          </div>
        </div>
      )}
    </>
  )
}

// ── Petits helpers de style ───────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 }}>
      {children}
    </div>
  )
}
function segBtn(active) {
  return {
    padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'var(--green-light)' : 'var(--white)',
    color: active ? 'var(--green-dark)' : 'var(--text-muted)',
  }
}

// Section repliée (défaut fermé) — pour ranger les réglages secondaires.
function Collapsible({ label, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ margin: '4px 0 16px', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}
      >
        {label}
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

// kcal courant / cible, coloré par l'écart. Remplace les 5 pastilles de macros
// dans l'aperçu — le détail P/G/L/fibres s'ouvre au tap.
function KcalPill({ kcal, target }) {
  const level = deviationLevel(kcal, target)
  return (
    <span style={{ fontSize: 12.5, fontWeight: 700, color: LEVEL_COLOR[level], flexShrink: 0, whiteSpace: 'nowrap' }}>
      {r0(kcal)}
      {target > 0 && <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}> / {r0(target)}</span>} kcal
    </span>
  )
}

export default function MealPlannerModal({ onClose, onApplied, defaultStartDate, initialLoadPlanId, replaceGroupId, replaceStartDate }) {
  useBackButton(onClose)
  const planner = useMealPlanner({ defaultStartDate })
  const toast = useToast()
  const [step, setStep] = useState('config')
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState(null)
  const [shoppingState, setShoppingState] = useState('idle') // 'idle' | 'busy' | 'done'
  const [batchState, setBatchState] = useState('idle') // 'idle' | 'busy' | 'done'
  const [removing, setRemoving] = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  // Plan enregistré actuellement chargé (table plans_repas), ou null.
  const [savedPlanId, setSavedPlanId] = useState(null)

  const { plans: savedPlans, savePlan, updatePlan, renamePlan, deletePlan } = useMealPlans()

  // Vrai quand on ré-applique un plan qu'on est en train de MODIFIER, sur la
  // même semaine : on remplace l'ancien (retrait de ses lignes avant écriture).
  const replacingWeekPlan = !!replaceGroupId && planner.config.startDateStr === replaceStartDate

  // Fournée de la semaine du 1er jour du plan (les recettes / repas types du
  // plan appliqué y sont versés).
  const { addSources: addBatchSources } = useBatchCooking(mondayOf(planner.config.startDateStr))

  // Liste de courses cible (la plus récente par défaut).
  const { listes: shoppingLists, createListe } = useShoppingLists()
  const [shoppingListId, setShoppingListId] = useState(null)
  useEffect(() => {
    if (!shoppingListId && shoppingLists.length) setShoppingListId(shoppingLists[0].id)
  }, [shoppingLists, shoppingListId])
  const { addPlannedItems, clearAllItems } = useShoppingListItems(shoppingListId)
  // Vider la liste cible avant d'y verser le plan (utile quand on remplace un
  // plan : sinon les ingrédients de l'ancien plan restent). Coché par défaut
  // quand on est en train de remplacer.
  const [clearListFirst, setClearListFirst] = useState(false)
  useEffect(() => { setClearListFirst(replacingWeekPlan) }, [replacingWeekPlan])

  const recettesById = useMemo(
    () => Object.fromEntries(planner.recettes.map(r => [r.id, r])),
    [planner.recettes],
  )
  const templatesById = useMemo(
    () => Object.fromEntries(planner.repasTypes.map(t => [t.id, t])),
    [planner.repasTypes],
  )

  // Crée une liste de courses à la volée et la sélectionne comme cible.
  const handleCreateList = async (name) => {
    setCreatingList(true)
    const { data, error } = await createListe((name || '').trim() || 'Plan de repas')
    setCreatingList(false)
    if (error || !data) { toast('Erreur à la création de la liste'); return null }
    setShoppingListId(data.id)
    return data
  }

  const resetApply = () => { setApplyResult(null); setShoppingState('idle'); setBatchState('idle') }
  // « Générer » depuis les réglages = plan neuf → on le détache du plan
  // enregistré éventuellement chargé. « Régénérer » depuis l'aperçu garde le
  // rattachement (on continue d'éditer le même plan enregistré).
  const handleGenerate = () => { planner.generate(); setSavedPlanId(null); resetApply(); setStep('preview') }
  const handleRegenerate = () => { planner.regenerate(); resetApply() }

  const defaultPlanName = `Plan du ${shortDate(planner.config.startDateStr)} · ${planner.config.days} j`

  const handleLoadPlan = useCallback((id) => {
    const saved = savedPlans.find(p => p.id === id)
    if (!saved) return
    const ok = planner.loadSavedPlan(saved)
    if (!ok) { toast('Ce plan enregistré est vide'); return }
    setSavedPlanId(id)
    resetApply()
    setStep('preview')
  }, [savedPlans, planner, toast])

  // « Modifier mon plan » (vue Menus) : ouvre directement le plan enregistré
  // du plan appliqué sur cette semaine. On n'auto-charge qu'une fois, quand la
  // liste des plans est arrivée.
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (autoLoadedRef.current || !initialLoadPlanId || !savedPlans.length) return
    if (savedPlans.some(p => p.id === initialLoadPlanId)) {
      autoLoadedRef.current = true
      handleLoadPlan(initialLoadPlanId)
    }
  }, [initialLoadPlanId, savedPlans, handleLoadPlan])

  const handleSavePlan = async (name, { asNew } = {}) => {
    const payload = { nom: name, config: planner.config, plan: planner.plan }
    if (savedPlanId && !asNew) {
      const { error } = await updatePlan(savedPlanId, payload)
      if (error) { toast('Erreur à l’enregistrement'); return }
      toast('✓ Plan mis à jour')
    } else {
      const { data, error } = await savePlan(payload)
      if (error || !data) { toast('Erreur à l’enregistrement'); return }
      setSavedPlanId(data.id)
      toast('✓ Plan enregistré')
    }
  }

  const handleDeletePlan = async (id) => {
    const { error } = await deletePlan(id)
    if (error) { toast('Erreur'); return }
    if (id === savedPlanId) setSavedPlanId(null)
    toast('Plan supprimé')
  }

  // Verse les recettes ET repas types du plan (récap « À préparer ») dans la
  // page « Ma fournée », avec le nombre de portions à préparer. Appelé
  // automatiquement à « Appliquer au calendrier » (silencieux) et via le
  // bouton du récap.
  const addPlanRecipesToBatch = async ({ silent = false } = {}) => {
    if (!planner.plan) return { added: 0 }
    const list = batchSummary(planner.plan, { recettesById, templatesById })
      .map(b => ({ id: b.id, nom: b.nom, portions: b.portionsNeeded, kind: b.kind }))
    if (!list.length) { if (!silent) toast('Rien à envoyer'); return { added: 0 } }
    setBatchState('busy')
    const { error, added } = await addBatchSources(list)
    if (error) {
      setBatchState('idle')
      if (!silent) toast('Erreur à l’envoi vers Ma fournée')
      return { added: 0, error }
    }
    setBatchState('done')
    if (!silent) toast(added ? `✓ ${added} ajouté${added > 1 ? 's' : ''} à Ma fournée` : 'Déjà dans Ma fournée')
    return { added }
  }

  const handleApply = async ({ startDateStr, conflictStrategy }) => {
    setApplying(true)
    const replacing = !!replaceGroupId && startDateStr === replaceStartDate
    if (replacing) {
      await planner.removePlan(replaceGroupId)
      removeAppliedPlan(replaceGroupId)
    }
    const res = await planner.applyToCalendar({ startDateStr, conflictStrategy })
    setApplying(false)
    if (res.error) { toast('Erreur à l\'enregistrement'); return }
    if (res.inserted === 0) { toast('Rien à ajouter (créneaux occupés ou jours exclus)'); return }
    setApplyResult(res)
    setShoppingState('idle')

    // Enregistre le plan (s'il ne l'est pas déjà), sinon met à jour le
    // snapshot enregistré — pour que « Modifier mon plan » rouvre bien la
    // version qui est sur le calendrier. Lien groupId ↔ savedPlanId dans le stash.
    let planId = savedPlanId
    if (!planId) {
      const { data } = await savePlan({ nom: defaultPlanName, config: planner.config, plan: planner.plan })
      if (data) { planId = data.id; setSavedPlanId(data.id) }
    } else {
      updatePlan(planId, { config: planner.config, plan: planner.plan })
    }

    if (res.groupId) {
      stashAppliedPlan({
        groupId: res.groupId,
        startDateStr,
        days: planner.plan?.days.length || 0,
        savedPlanId: planId || null,
        appliedAt: Date.now(),
      })
    }
    // Verse aussi les recettes du plan dans « Ma fournée » (check-list de
    // batch cooking), silencieusement — un seul toast récapitulatif.
    const b = await addPlanRecipesToBatch({ silent: true })
    toast(
      `✓ ${res.inserted} repas ajoutés`
      + (b?.added ? ` · ${b.added} recette${b.added > 1 ? 's' : ''} dans Ma fournée` : ''),
    )
    onApplied?.()
  }

  const handleGenerateShopping = async () => {
    if (!applyResult?.rows?.length || !shoppingListId) return
    setShoppingState('busy')
    try {
      if (clearListFirst) {
        const { error: clearErr } = await clearAllItems()
        if (clearErr) {
          setShoppingState('idle')
          toast('Erreur en vidant la liste')
          return
        }
      }
      const { error } = await addPlannedItems(applyResult.rows, { multiplier: planner.config.people })
      if (error) {
        console.error('[planificateur] liste de courses :', error)
        setShoppingState('idle')
        toast(`Erreur liste de courses : ${error.message || error.code || 'inconnue'}`)
        return
      }
      setShoppingState('done')
      toast('✓ Ajouté à la liste de courses')
    } catch (e) {
      console.error('[planificateur] liste de courses (exception) :', e)
      setShoppingState('idle')
      toast(`Erreur liste de courses : ${e?.message || e}`)
    }
  }

  const handleRemovePlan = async () => {
    if (!applyResult?.groupId) return
    setRemoving(true)
    const { error } = await planner.removePlan(applyResult.groupId)
    setRemoving(false)
    if (error) { toast('Erreur au retrait'); return }
    removeAppliedPlan(applyResult.groupId)
    resetApply()
    toast('Plan retiré du calendrier')
    onApplied?.()
  }

  return (
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Planifier ma semaine</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {planner.dataLoading ? (
          <Loader />
        ) : step === 'config' ? (
          <ConfigView
            planner={planner}
            onGenerate={handleGenerate}
            savedPlans={savedPlans}
            onLoadPlan={handleLoadPlan}
            onRenamePlan={renamePlan}
            onDeletePlan={handleDeletePlan}
          />
        ) : (
          <PreviewView
            plan={planner.plan}
            startDateStr={planner.config.startDateStr}
            recettesById={recettesById}
            templatesById={templatesById}
            people={planner.config.people}
            generating={planner.generating}
            lockedKeys={planner.lockedKeys}
            onToggleLock={planner.toggleLock}
            onToggleLockDay={planner.toggleLockDay}
            swapCandidates={planner.swapCandidates}
            onSwapItem={planner.swapItem}
            onRemoveItem={planner.removeItem}
            onSetItemPortions={planner.setItemPortions}
            onAddToBatch={() => addPlanRecipesToBatch()}
            batchState={batchState}
            savedPlanId={savedPlanId}
            savedPlanName={savedPlans.find(p => p.id === savedPlanId)?.nom}
            defaultPlanName={defaultPlanName}
            onSavePlan={handleSavePlan}
            replacing={replacingWeekPlan}
            onBack={() => setStep('config')}
            onRegenerate={handleRegenerate}
            onApply={handleApply}
            applying={applying}
            result={applyResult}
            applied={{
              shoppingLists,
              shoppingListId,
              setShoppingListId,
              onCreateList: handleCreateList,
              creatingList,
              onGenerateShopping: handleGenerateShopping,
              shoppingState,
              clearListFirst,
              setClearListFirst,
              onRemovePlan: handleRemovePlan,
              removing,
            }}
          />
        )}
      </div>
    </div>
  )
}
