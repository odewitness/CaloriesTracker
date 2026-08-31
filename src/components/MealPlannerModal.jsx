import React, { useState } from 'react'
import { X, Wand2, RefreshCw, ChevronLeft, Plus, Trash2, AlertTriangle, CalendarPlus, Check } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useMealPlanner } from '../hooks/useMealPlanner'
import { useToast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import { deviationLevel } from '../lib/mealPlanner'
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

// ── Éditeur de composition d'un repas ──────────────────────────────────────
function MealSlotsEditor({ meal, slots, onChange }) {
  const setSlot = (i, patch) => onChange(slots.map((s, si) => si === i ? { ...s, ...patch } : s))
  const removeSlot = (i) => onChange(slots.filter((_, si) => si !== i))
  const addSlot = () => onChange([...slots, { type: 'recette', categorie: 'Plat', nbDifferentes: 2 }])

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{meal}</div>
      {slots.map((slot, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <select
            className="input"
            value={slot.type === 'repas_type' ? '__repas_type__' : slot.categorie}
            onChange={e => {
              const v = e.target.value
              if (v === '__repas_type__') setSlot(i, { type: 'repas_type', categorie: undefined })
              else setSlot(i, { type: 'recette', categorie: v })
            }}
            style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
          >
            {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__repas_type__">Un repas type</option>
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
    </div>
  )
}

// ── Vue configuration ─────────────────────────────────────────────────────
function ConfigView({ planner, onGenerate }) {
  const { config, mealConfig, setConfig, setMealConfig, recipeCount, templateCount, favoriteCount } = planner

  return (
    <>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        On choisit des recettes qui approchent au mieux tes objectifs de macros, puis on complète
        chaque repas avec un ou deux aliments piochés dans tes favoris. Rien n'est ajouté au
        calendrier sans que tu valides l'aperçu.
      </div>

      {/* Jours */}
      <SectionLabel>Nombre de jours</SectionLabel>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <button
            key={n}
            onClick={() => setConfig({ days: n })}
            style={segBtn(config.days === n)}
          >{n}</button>
        ))}
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
      <SectionLabel>Composition des repas</SectionLabel>
      <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '2px 0 8px' }}>
        Pour chaque repas, les briques et le nombre de recettes différentes sur la période
        (2× = deux recettes différentes qui tournent sur les jours).
      </div>
      {Object.keys(mealConfig).length === 0 && (
        <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--text-hint)', textAlign: 'center', marginBottom: 8 }}>
          Aucun repas activé. Active des repas depuis Profil.
        </div>
      )}
      {Object.entries(mealConfig).map(([meal, slots]) => (
        <MealSlotsEditor
          key={meal}
          meal={meal}
          slots={slots}
          onChange={next => setMealConfig(mc => ({ ...mc, [meal]: next }))}
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

// ── Vue aperçu ────────────────────────────────────────────────────────────
function PreviewView({ plan, onBack, onRegenerate, generating, onApply, applying, result }) {
  const dayLabels = ['Jour 1', 'Jour 2', 'Jour 3', 'Jour 4', 'Jour 5', 'Jour 6', 'Jour 7']
  const [startDateStr, setStartDateStr] = useState(todayStr())
  const [allowConflicts, setAllowConflicts] = useState(false)

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

      {/* Niveau 3 : semaine */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--green)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
          Sur {plan.days.length} jour{plan.days.length > 1 ? 's' : ''}
        </div>
        <MacroRow totals={plan.weekTotals} target={plan.weekTarget} />
      </div>

      {/* Niveau 2 & 1 : jour puis repas */}
      {plan.days.map((day, di) => (
        <div key={di} className="card" style={{ padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{dayLabels[di]}</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <MacroRow totals={day.totals} target={day.target} />
          </div>

          {day.meals.map((m, mi) => (
            <div key={mi} style={{ borderTop: '1px solid var(--border)', paddingTop: 7, marginTop: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{m.meal}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: LEVEL_COLOR[deviationLevel(m.totals.kcal, m.target.kcal)] }}>
                  {r0(m.totals.kcal)} / {r0(m.target.kcal)} kcal
                </span>
              </div>
              {m.items.map((it, ii) => (
                <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: it.kind === 'ajout' ? 'var(--green-dark)' : 'var(--text)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {it.kind === 'ajout' ? '+ ' : ''}{it.nom}
                    {it.kind === 'ajout' && <span style={{ color: 'var(--text-hint)' }}> · {r0(it.qty_g)} g</span>}
                    {it.kind === 'recette' && it.portionG && <span style={{ color: 'var(--text-hint)' }}> · 1 portion</span>}
                    {it.kind === 'repas_type' && <span style={{ color: 'var(--text-hint)' }}> · 1 part</span>}
                  </span>
                  <span style={{ color: 'var(--text-hint)', flexShrink: 0 }}>{r0(it.macros.kcal)} kcal</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* Appliquer au calendrier */}
      {result?.inserted > 0 ? (
        <div className="card" style={{ padding: '14px', marginTop: 4, background: 'var(--green-light)', border: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', marginBottom: result.skippedConflict?.length || result.skippedExcluded?.length ? 6 : 0 }}>
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
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            Pour la liste de courses : « Depuis mes repas prévus » dans tes courses, sur cette période.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '12px 14px', marginTop: 4 }}>
          <SectionLabel>Appliquer au calendrier</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 8px' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>À partir du</span>
            <input
              type="date" className="input" value={startDateStr}
              onChange={e => setStartDateStr(e.target.value)}
              style={{ flex: 1, fontSize: 12.5, padding: '6px 8px' }}
            />
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
            Crée un repas prévu par jour et par repas. Rien n'est écrasé ni supprimé. Tu pourras
            retirer tout le plan d'un coup depuis « Mes programmations ».
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

export default function MealPlannerModal({ onClose, onApplied }) {
  useBackButton(onClose)
  const planner = useMealPlanner()
  const toast = useToast()
  const [step, setStep] = useState('config')
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState(null)

  const handleGenerate = () => { planner.generate(); setApplyResult(null); setStep('preview') }
  const handleRegenerate = () => { planner.regenerate(); setApplyResult(null) }

  const handleApply = async ({ startDateStr, conflictStrategy }) => {
    setApplying(true)
    const res = await planner.applyToCalendar({ startDateStr, conflictStrategy })
    setApplying(false)
    if (res.error) { toast('Erreur à l\'enregistrement'); return }
    if (res.inserted === 0) { toast('Rien à ajouter (créneaux occupés ou jours exclus)'); return }
    setApplyResult(res)
    toast(`✓ ${res.inserted} repas ajoutés`)
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
            generating={planner.generating}
            onBack={() => setStep('config')}
            onRegenerate={handleRegenerate}
            onApply={handleApply}
            applying={applying}
            result={applyResult}
          />
        )}
      </div>
    </div>
  )
}
