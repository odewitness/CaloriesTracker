import React, { useEffect, useMemo, useState } from 'react'
import { X, Wand2, RefreshCw, ChevronLeft, Plus, Trash2, AlertTriangle, CalendarPlus, Check, ShoppingCart, ChefHat, Lock, LockOpen } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useMealPlanner } from '../hooks/useMealPlanner'
import { useShoppingLists, useShoppingListItems } from '../hooks/useShoppingLists'
import { useToast } from '../lib/toast'
import { deviationLevel, batchSummary, slotGroupKey } from '../lib/mealPlanner'
import { addDaysStr, stashAppliedPlan, removeAppliedPlan } from '../lib/mealPlannerApply'
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

// "recette telle quelle" / "2× la recette" / "×1,25 (prévue pour 4)"
function factorLabel(b) {
  if (Math.abs(b.factor - 1) < 0.01) return 'recette telle quelle'
  if (Math.abs(b.factor - Math.round(b.factor)) < 0.01) return `${Math.round(b.factor)}× la recette`
  return `×${b.factor.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} (prévue pour ${b.baseYield})`
}

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

const MIXTE_PLAT = '__mixte_plat__'
const REPAS_TYPE = '__repas_type__'

function slotSelectValue(slot) {
  if (slot.type === 'repas_type') return REPAS_TYPE
  if (slot.type === 'mixte') return MIXTE_PLAT
  return slot.categorie
}
function slotFromSelectValue(v) {
  if (v === REPAS_TYPE) return { type: 'repas_type', categorie: undefined }
  if (v === MIXTE_PLAT) return { type: 'mixte', categorie: 'Plat' }
  return { type: 'recette', categorie: v }
}

// ── Éditeur de composition d'un repas ──────────────────────────────────────
function MealSlotsEditor({ meal, slots, included, onToggleIncluded, onChange }) {
  const setSlot = (i, patch) => onChange(slots.map((s, si) => si === i ? { ...s, ...patch } : s))
  const removeSlot = (i) => onChange(slots.filter((_, si) => si !== i))
  const addSlot = () => onChange([...slots, { type: 'recette', categorie: 'Plat', nbDifferentes: 2 }])

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 8, opacity: included ? 1 : 0.55 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, marginBottom: included ? 6 : 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={included} onChange={onToggleIncluded} />
        {meal}
        {!included && <span style={{ fontWeight: 500, color: 'var(--text-hint)', fontSize: 11 }}>— pas dans ce plan</span>}
      </label>
      {included && (
        <>
          {slots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <select
                className="input"
                value={slotSelectValue(slot)}
                onChange={e => setSlot(i, slotFromSelectValue(e.target.value))}
                style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
              >
                <option value={MIXTE_PLAT}>Plat ou repas type</option>
                {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value={REPAS_TYPE}>Un repas type</option>
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
          ))}
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

// ── Vue configuration ─────────────────────────────────────────────────────
function ConfigView({ planner, onGenerate }) {
  const {
    config, mealConfig, baseMealConfig, excludedMeals, setConfig, setMealConfig, toggleMeal,
    recipeCount, templateCount, favoriteCount,
  } = planner
  const excluded = new Set(excludedMeals)

  // Change les slots d'un repas ET synchronise le « N× » entre tous les slots
  // qui partagent la même clé de groupe (ex. « Plat » au déjeuner et au dîner).
  const changeMealSlots = (meal, nextSlots) => setMealConfig(mc => {
    const updated = { ...mc, [meal]: nextSlots }
    const nByKey = {}
    for (const s of nextSlots) nByKey[slotGroupKey(s)] = s.nbDifferentes
    for (const [mn, slots] of Object.entries(updated)) {
      updated[mn] = slots.map(s => nByKey[slotGroupKey(s)] != null ? { ...s, nbDifferentes: nByKey[slotGroupKey(s)] } : s)
    }
    return updated
  })

  return (
    <>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        On choisit des recettes qui approchent au mieux tes objectifs de macros, puis on complète
        chaque repas avec un ou deux aliments piochés dans tes favoris. Rien n'est ajouté au
        calendrier sans que tu valides l'aperçu.
      </div>

      {/* Jours */}
      <SectionLabel>Nombre de jours</SectionLabel>
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <button
            key={n}
            onClick={() => setConfig({ days: n })}
            style={segBtn(config.days === n)}
          >{n}</button>
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
      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 16 }}>
        {rangeLabel(config.startDateStr, config.days)}
      </div>

      {/* Personnes */}
      <SectionLabel>Nombre de personnes</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button className="btn-icon" onClick={() => setConfig({ people: Math.max(1, config.people - 1) })} aria-label="Moins">−</button>
        <span style={{ fontSize: 15, fontWeight: 700, width: 24, textAlign: 'center' }}>{config.people}</span>
        <button className="btn-icon" onClick={() => setConfig({ people: Math.min(12, config.people + 1) })} aria-label="Plus">+</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 16 }}>
        Sert aux quantités de la liste de courses, pas au calcul des macros par portion.
      </div>

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
        N'utiliser que les recettes de cette saison (sinon : simple préférence)
      </label>

      {/* Composition des repas */}
      <SectionLabel>Repas & composition</SectionLabel>
      <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '2px 0 8px' }}>
        Décoche un repas pour ne pas l'inclure. Pour chaque repas, les briques et le nombre de
        recettes différentes sur la période (2× = deux recettes qui tournent sur les jours ;
        « Plat » partagé entre déjeuner et dîner compte une seule fois).
      </div>
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
        />
      ))}

      <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '10px 0 14px' }}>
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
function ItemEditor({ item, candidates, onSwap, onRemove }) {
  const isAddon = item.kind === 'ajout'
  return (
    <div style={{ background: 'var(--gray-bg)', borderRadius: 6, padding: '6px 8px', margin: '2px 0 6px' }}>
      {!isAddon && (
        <>
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

// ── Vue aperçu ────────────────────────────────────────────────────────────
function PreviewView({
  plan, startDateStr, recettesById, templatesById, people,
  onBack, onRegenerate, generating, onApply, applying, result, applied,
  lockedKeys, onToggleLock, onToggleLockDay,
  swapCandidates, onSwapItem, onRemoveItem,
}) {
  const [allowConflicts, setAllowConflicts] = useState(false)
  const [editing, setEditing] = useState(null) // { di, meal, ii } | null
  useEffect(() => { setEditing(null) }, [plan])
  const anyLocked = lockedKeys && lockedKeys.size > 0
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

      {anyLocked && (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '-4px 0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={11} /> Les repas verrouillés sont conservés à la régénération.
        </div>
      )}

      {plan.warnings?.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 12, background: 'var(--amber-light)', border: 'none' }}>
          {plan.warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: 'var(--amber)', fontWeight: 600, marginBottom: i < plan.warnings.length - 1 ? 4 : 0 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Niveau 3 : semaine */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--green)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
          Sur {plan.days.length} jour{plan.days.length > 1 ? 's' : ''}
        </div>
        <MacroRow totals={plan.weekTotals} target={plan.weekTarget} />
      </div>

      {/* Niveau 2 & 1 : jour puis repas */}
      {plan.days.map((day, di) => {
        const dayMealNames = day.meals.map(m => m.meal)
        const dayAllLocked = dayMealNames.length > 0 && dayMealNames.every(m => lockedKeys?.has(`${di}|${m}`))
        return (
        <div key={di} className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{dayChipLabel(startDateStr, di)}</span>
            <button
              onClick={() => onToggleLockDay(di, dayMealNames)}
              className="btn-icon"
              aria-label={dayAllLocked ? 'Déverrouiller la journée' : 'Verrouiller la journée'}
              style={{ width: 26, height: 26, color: dayAllLocked ? 'var(--green-dark)' : 'var(--text-hint)' }}
            >
              {dayAllLocked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
          </div>
          <div style={{ marginBottom: 8 }}>
            <MacroRow totals={day.totals} target={day.target} />
          </div>

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
                      {it.kind === 'recette' && it.portionG && <span style={{ color: 'var(--text-hint)' }}> · 1 portion</span>}
                      {it.kind === 'repas_type' && <span style={{ color: 'var(--text-hint)' }}> · 1 part</span>}
                    </span>
                    <span style={{ color: 'var(--text-hint)', flexShrink: 0 }}>{r0(it.macros.kcal)} kcal</span>
                  </button>
                  {isOpen && (
                    <ItemEditor
                      item={it}
                      candidates={it.kind === 'ajout' ? [] : swapCandidates(di, m.meal, ii)}
                      onSwap={(cid) => { onSwapItem(di, m.meal, ii, cid); setEditing(null) }}
                      onRemove={() => { onRemoveItem(di, m.meal, ii); setEditing(null) }}
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
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                {b.portionsNeeded} portion{b.portionsNeeded > 1 ? 's' : ''}
                <span style={{ color: 'var(--text-hint)' }}> · {factorLabel(b)}</span>
              </span>
            </div>
          ))}
          {people > 1 && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 5 }}>
              Quantités pour 1 personne. Pour {people}, multiplie par {people}.
            </div>
          )}
        </div>
      )}

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
            {applied.shoppingLists.length > 1 && (
              <select
                className="input"
                value={applied.shoppingListId || ''}
                onChange={e => applied.setShoppingListId(e.target.value)}
                style={{ fontSize: 12.5, padding: '6px 8px', marginBottom: 6, width: '100%' }}
              >
                {applied.shoppingLists.map(l => <option key={l.id} value={l.id}>{l.nom}</option>)}
              </select>
            )}
            <button
              className="btn-primary"
              onClick={applied.onGenerateShopping}
              disabled={applied.shoppingState === 'busy' || !applied.shoppingListId || applied.shoppingState === 'done'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!applied.shoppingListId || applied.shoppingState === 'done') ? 0.6 : 1 }}
            >
              <ShoppingCart size={15} />
              {applied.shoppingState === 'busy' ? 'Ajout…'
                : applied.shoppingState === 'done' ? '✓ Ajouté à la liste'
                : 'Générer la liste de courses'}
            </button>
            {!applied.shoppingListId && (
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 5 }}>
                Crée d'abord une liste dans l'onglet « Mes courses ».
              </div>
            )}
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
          <SectionLabel>Appliquer au calendrier</SectionLabel>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 8px' }}>
            {rangeLabel(startDateStr, plan.days.length)}
            <button
              onClick={onBack}
              style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--green-dark)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
            >
              changer
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
            <input type="checkbox" checked={allowConflicts} onChange={e => setAllowConflicts(e.target.checked)} />
            Ajouter même si un repas est déjà prévu sur le créneau
          </label>
          <button
            className="btn-primary"
            onClick={() => onApply({ startDateStr, conflictStrategy: allowConflicts ? 'add' : 'skip' })}
            disabled={applying}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: applying ? 0.5 : 1 }}
          >
            <CalendarPlus size={16} /> {applying ? 'Ajout…' : 'Appliquer au calendrier'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8, lineHeight: 1.5 }}>
            Crée un repas prévu par jour et par repas. Rien n'est écrasé ni supprimé. Ensuite tu
            pourras générer la liste de courses, ou retirer tout le plan d'un coup.
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

export default function MealPlannerModal({ onClose, onApplied, defaultStartDate }) {
  useBackButton(onClose)
  const planner = useMealPlanner({ defaultStartDate })
  const toast = useToast()
  const [step, setStep] = useState('config')
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState(null)
  const [shoppingState, setShoppingState] = useState('idle') // 'idle' | 'busy' | 'done'
  const [removing, setRemoving] = useState(false)

  // Liste de courses cible (la plus récente par défaut).
  const { listes: shoppingLists } = useShoppingLists()
  const [shoppingListId, setShoppingListId] = useState(null)
  useEffect(() => {
    if (!shoppingListId && shoppingLists.length) setShoppingListId(shoppingLists[0].id)
  }, [shoppingLists, shoppingListId])
  const { addPlannedItems } = useShoppingListItems(shoppingListId)

  const recettesById = useMemo(
    () => Object.fromEntries(planner.recettes.map(r => [r.id, r])),
    [planner.recettes],
  )
  const templatesById = useMemo(
    () => Object.fromEntries(planner.repasTypes.map(t => [t.id, t])),
    [planner.repasTypes],
  )

  const resetApply = () => { setApplyResult(null); setShoppingState('idle') }
  const handleGenerate = () => { planner.generate(); resetApply(); setStep('preview') }
  const handleRegenerate = () => { planner.regenerate(); resetApply() }

  const handleApply = async ({ startDateStr, conflictStrategy }) => {
    setApplying(true)
    const res = await planner.applyToCalendar({ startDateStr, conflictStrategy })
    setApplying(false)
    if (res.error) { toast('Erreur à l\'enregistrement'); return }
    if (res.inserted === 0) { toast('Rien à ajouter (créneaux occupés ou jours exclus)'); return }
    setApplyResult(res)
    setShoppingState('idle')
    if (res.groupId) {
      stashAppliedPlan({
        groupId: res.groupId,
        startDateStr,
        days: planner.plan?.days.length || 0,
        appliedAt: Date.now(),
      })
    }
    toast(`✓ ${res.inserted} repas ajoutés`)
    onApplied?.()
  }

  const handleGenerateShopping = async () => {
    if (!applyResult?.rows?.length || !shoppingListId) return
    setShoppingState('busy')
    try {
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
          <ConfigView planner={planner} onGenerate={handleGenerate} />
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
            onBack={() => setStep('config')}
            onRegenerate={handleRegenerate}
            onApply={handleApply}
            applying={applying}
            result={applyResult}
            applied={{
              shoppingLists,
              shoppingListId,
              setShoppingListId,
              onGenerateShopping: handleGenerateShopping,
              shoppingState,
              onRemovePlan: handleRemovePlan,
              removing,
            }}
          />
        )}
      </div>
    </div>
  )
}
