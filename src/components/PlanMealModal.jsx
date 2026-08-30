import React, { useState, useEffect } from 'react'
import { X, ArrowLeft, Apple, UtensilsCrossed, CalendarDays, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { useBackButton } from '../hooks/useBackButton'
import { MEALS_ORDER as MEALS, scaleFood } from '../lib/nutrients'
import { createPlannedMeals } from '../hooks/usePlannedMeals'
import FoodPicker from './FoodPicker'
import AddFromRecipeModal from './AddFromRecipeModal'
import CalendarMonthGrid, { WEEKDAYS } from './CalendarMonthGrid'
import { SUPPLEMENT_MEAL } from './SupplementSection'
import { fmt } from '../lib/dates'
import Loader from './Loader'
import EmptyState from './EmptyState'

const RECURRENCE_CAP = 90

// Génère la liste de dates ('YYYY-MM-DD') correspondant à un motif de
// récurrence, à partir de startStr (inclus) jusqu'à endStr (inclus).
// weekdays est un Set d'indices 0=lundi..6=dimanche (même convention que
// WEEKDAYS/CalendarMonthGrid). Plafonné à RECURRENCE_CAP dates.
function computeRecurrenceDates(startStr, pattern, weekdays, endStr) {
  if (pattern === 'once') return [startStr]
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date((endStr || startStr) + 'T00:00:00')
  const dates = []
  const cur = new Date(start)
  while (cur <= end && dates.length < RECURRENCE_CAP) {
    const dow = (cur.getDay() + 6) % 7
    if (pattern === 'daily' || (pattern === 'weekdays' && weekdays.has(dow))) {
      dates.push(fmt(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// ─────────────────────────────────────────────────────────────────────────────
// RepasTypePicker — étape "choisir un repas type" (liste simple, comme
// AddFromRecipeModal étape 1, mais sur la table repas_types).
// ─────────────────────────────────────────────────────────────────────────────
function RepasTypePicker({ onSelect, onClose }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      if (!user) { setRepasList([]); setLoading(false); return }
      const { data } = await supabase.from('repas_types').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      setRepasList(data || [])
      setLoading(false)
    })()
  }, [user])

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Choisir un repas type</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {loading && <Loader />}
        {!loading && repasList.length === 0 && (
          <EmptyState icon={<UtensilsCrossed size={40} />} title="Aucun repas type" description={`Crée d'abord un repas type dans "Mes aliments"`} />
        )}
        {repasList.map(r => {
          const kcal = (r.items || []).reduce((s, i) => s + (i.energie_kcal || 0), 0)
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="card"
              style={{ width: '100%', marginBottom: 8, padding: '12px 14px', textAlign: 'left' }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nom}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {(r.items || []).length} aliment{(r.items || []).length > 1 ? 's' : ''} · {Math.round(kcal)} kcal
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SourcePicker — étape 0, seulement si aucun presetSource n'est fourni
// (ouverture générique depuis le calendrier, "+ Planifier un repas").
// ─────────────────────────────────────────────────────────────────────────────
function SourcePicker({ onPick, onClose }) {
  useBackButton(onClose)
  const options = [
    { id: 'libre',      icon: Apple,          label: 'Aliment libre',  desc: 'Rechercher un aliment ou un plat' },
    { id: 'recette',    icon: UtensilsCrossed, label: 'Une recette',   desc: 'Depuis une de tes recettes' },
    { id: 'repas_type', icon: CalendarDays,    label: 'Un repas type', desc: 'Depuis un repas type sauvegardé' },
  ]
  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Planifier un repas</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {options.map(({ id, icon: Icon, label, desc }) => (
          <button
            key={id}
            onClick={() => onPick(id)}
            className="card"
            style={{ width: '100%', marginBottom: 10, padding: '14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const RECURRENCE_PATTERNS = [
  { id: 'once', label: 'Une seule fois' },
  { id: 'daily', label: 'Tous les jours' },
  { id: 'weekdays', label: 'Jours spécifiques' },
]

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

// ─────────────────────────────────────────────────────────────────────────────
// ScheduleStep — étape finale commune : choix d'un motif de récurrence (une
// fois / tous les jours / jours spécifiques) qui pré-coche les jours
// correspondants sur une grille calendrier cliquable (ajustable au cas par
// cas), puis choix du repas (sauté si forcedMeal est fourni — cas des
// compléments), puis création en une seule requête batch (createPlannedMeals).
// ─────────────────────────────────────────────────────────────────────────────
function ScheduleStep({ source, defaultDate, defaultMeal, forcedMeal, onBack, onClose, onPlanned }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const toast = useToast()

  const todayStr = fmt(new Date())
  const startStr = defaultDate ? fmt(defaultDate) : todayStr

  const [pattern, setPattern] = useState('once')
  const [weekdays, setWeekdays] = useState(() => new Set([(new Date(startStr + 'T00:00:00').getDay() + 6) % 7]))
  const [endDate, setEndDate] = useState(addDays(startStr, 30))
  const [selectedDates, setSelectedDates] = useState(() => new Set([startStr]))
  const [anchorMonth, setAnchorMonth] = useState(() => new Date(startStr + 'T00:00:00'))
  const [meal, setMeal] = useState(forcedMeal || (defaultMeal && MEALS.includes(defaultMeal) ? defaultMeal : MEALS[0]))
  const [saving, setSaving] = useState(false)

  // Motif/fin/jours changés → régénère intégralement la sélection. Les clics
  // directs sur la grille (toggleGridDate) ne passent jamais par ici : ils
  // permettent d'ajuster la sélection générée sans qu'elle ne soit écrasée.
  useEffect(() => {
    const dates = computeRecurrenceDates(startStr, pattern, weekdays, endDate)
    if (dates.length >= RECURRENCE_CAP) toast(`Limité à ${RECURRENCE_CAP} jours`)
    setSelectedDates(new Set(dates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, endDate, [...weekdays].sort().join(',')])

  const toggleWeekday = (i) => {
    setWeekdays(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const toggleGridDate = (date) => {
    const d = fmt(date)
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  const confirm = async () => {
    if (selectedDates.size === 0) { toast('Choisis au moins un jour'); return }
    setSaving(true)
    const { error } = await createPlannedMeals({
      userId: user.id,
      dates: [...selectedDates].sort(),
      meal: forcedMeal || meal,
      nom: source.nom,
      items: source.items,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
    })
    setSaving(false)
    if (error) toast('Erreur lors de la planification')
    else {
      toast(`✓ ${source.nom} planifié sur ${selectedDates.size} jour${selectedDates.size > 1 ? 's' : ''}`)
      onPlanned()
      onClose()
    }
  }

  const totalKcal = (source.items || []).reduce((s, i) => s + (i.energie_kcal || 0), 0)

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        {onBack ? (
          <button className="btn-icon" onClick={onBack} style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></button>
        ) : <div style={{ width: 32, flexShrink: 0 }} />}
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.nom}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body">
        <div className="card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{(source.items || []).length} aliment{(source.items || []).length > 1 ? 's' : ''}</span>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(totalKcal)} kcal</span>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Récurrence
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {RECURRENCE_PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              className="chip"
              style={pattern === p.id ? { background: 'var(--green)', color: 'white' } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>

        {pattern === 'weekdays' && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {WEEKDAYS.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWeekday(i)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8,
                  background: weekdays.has(i) ? 'var(--green)' : 'var(--gray-bg)',
                  color: weekdays.has(i) ? 'white' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        )}

        {pattern !== 'once' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', flexShrink: 0 }}>Jusqu'au</span>
            <input
              type="date"
              className="input"
              value={endDate}
              min={startStr}
              onChange={e => setEndDate(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Jour(s)
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)' }}>
            {selectedDates.size} sélectionné{selectedDates.size > 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <CalendarMonthGrid
            monthDate={anchorMonth}
            onChangeMonth={(dir) => setAnchorMonth(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))}
            selectedDates={selectedDates}
            onToggleDate={toggleGridDate}
            minDate={todayStr}
          />
        </div>

        {!forcedMeal && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              Repas
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {MEALS.map(m => {
                const active = meal === m
                return (
                  <button
                    key={m}
                    onClick={() => setMeal(m)}
                    style={{
                      flex: '1 1 auto', padding: '8px 10px', borderRadius: 8,
                      background: active ? 'var(--green)' : 'var(--gray-bg)',
                      color: active ? 'white' : 'var(--text-muted)',
                      fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', transition: 'all .15s',
                    }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <button className="btn-primary" onClick={confirm} disabled={saving || selectedDates.size === 0} style={{ opacity: saving || selectedDates.size === 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Check size={16} />
          {saving ? 'Planification...' : `Planifier sur ${selectedDates.size} jour${selectedDates.size > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanMealModal — orchestrateur.
// Props :
//   kind = 'repas' | 'complement' — 'complement' saute SourcePicker (pas de
//                  recette/repas type pour un complément) et verrouille le
//                  repas sur SUPPLEMENT_MEAL dans ScheduleStep.
//   presetSource — optionnel : { nom, items, sourceType, sourceId } déjà
//                  connu (ouverture depuis RecipeDetailModal ou MealTemplateCard) →
//                  saute directement à l'étape "jour(s) + repas".
//   defaultDate  — optionnel : Date pré-sélectionnée dans la grille de l'étape
//                  finale (ouverture depuis une case précise du calendrier /
//                  du plateau de menus).
//   defaultMeal  — optionnel : repas pré-sélectionné dans l'étape finale
//                  (ex. "+" sur la ligne "Déjeuner" du plateau de menus).
//                  Ignoré pour un complément (repas verrouillé).
//   onClose()
//   onPlanned()  — appelé après une planification réussie (refresh calendrier)
// ─────────────────────────────────────────────────────────────────────────────
export default function PlanMealModal({ kind = 'repas', presetSource, defaultDate, defaultMeal, onClose, onPlanned }) {
  const isComplement = kind === 'complement'
  const [step, setStep] = useState(presetSource ? 'schedule' : (isComplement ? 'libre' : 'source'))
  const [source, setSource] = useState(presetSource || null)

  // FoodPicker et AddFromRecipeModal appellent leur propre onClose() juste
  // après un onConfirm/onAdd réussi (pour se refermer eux-mêmes). Ici on ne
  // veut PAS fermer tout PlanMealModal dans ce cas, juste avancer à l'étape
  // suivante — d'où ce ref : on ne ferme réellement que si l'étape n'a pas
  // changé entre-temps (= annulation via X/retour, pas une validation).
  const stepRef = React.useRef(step)
  const goToStep = (s) => { stepRef.current = s; setStep(s) }
  const closeIfStillOn = (expectedStep) => () => { if (stepRef.current === expectedStep) onClose() }

  // ── Étape 0 : choix de la source (sautée pour un complément) ──────────
  if (step === 'source') {
    return (
      <SourcePicker
        onClose={onClose}
        onPick={(id) => goToStep(id)}
      />
    )
  }

  if (step === 'libre') {
    return (
      <FoodPicker
        title={isComplement ? 'Planifier un complément' : 'Planifier un aliment'}
        confirmLabel="Continuer"
        contextLabel="Choisis ensuite le(s) jour(s)"
        onConfirm={async (food, qty) => {
          const scaled = scaleFood(food, qty)
          setSource({ nom: scaled.food_name, items: [scaled], sourceType: 'libre', sourceId: null })
          goToStep('schedule')
        }}
        onClose={closeIfStillOn('libre')}
      />
    )
  }

  if (step === 'recette') {
    return (
      <AddFromRecipeModal
        defaultPortions={1}
        onAdd={async (recette, ingredients) => {
          setSource({ nom: recette.nom, items: ingredients, sourceType: 'recette', sourceId: recette.id })
          goToStep('schedule')
        }}
        onClose={closeIfStillOn('recette')}
      />
    )
  }

  if (step === 'repas_type') {
    return (
      <RepasTypePicker
        onClose={closeIfStillOn('repas_type')}
        onSelect={(repas) => {
          setSource({ nom: repas.nom, items: repas.items || [], sourceType: 'repas_type', sourceId: repas.id })
          goToStep('schedule')
        }}
      />
    )
  }

  // ── Étape finale : jour(s) + repas (repas verrouillé sur Compléments pour un complément) ──
  return (
    <ScheduleStep
      source={source}
      defaultDate={defaultDate}
      defaultMeal={defaultMeal}
      forcedMeal={isComplement ? SUPPLEMENT_MEAL : undefined}
      onBack={presetSource ? null : () => setStep(isComplement ? 'libre' : 'source')}
      onClose={onClose}
      onPlanned={onPlanned}
    />
  )
}