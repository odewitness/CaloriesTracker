import React, { useState, useEffect } from 'react'
import { X, ArrowLeft, Apple, UtensilsCrossed, CalendarDays, Plus, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { useBackButton } from '../hooks/useBackButton'
import { MEALS_ORDER as MEALS, scaleFood } from '../lib/nutrients'
import { createRepasPlanifie } from '../hooks/useRepasPlanifies'
import FoodPicker from './FoodPicker'
import AddFromRecipeModal from './AddFromRecipeModal'

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
        {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}
        {!loading && repasList.length === 0 && (
          <div className="empty">
            <UtensilsCrossed size={40} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Aucun repas type</div>
            <div style={{ marginTop: 4 }}>Crée d'abord un repas type dans "Mes aliments"</div>
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// ScheduleStep — étape finale commune : choix des jours (multi) + du repas,
// puis création d'un repas_planifies par jour sélectionné.
// ─────────────────────────────────────────────────────────────────────────────
function ScheduleStep({ source, defaultDate, onBack, onClose, onPlanned }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const toast = useToast()

  const todayStr = fmt(new Date())
  const tomorrowStr = fmt(new Date(Date.now() + 86400000))
  const afterTomorrowStr = fmt(new Date(Date.now() + 2 * 86400000))

  const [selectedDates, setSelectedDates] = useState([defaultDate ? fmt(defaultDate) : todayStr])
  const [customDate, setCustomDate] = useState('')
  const [meal, setMeal] = useState(MEALS[0])
  const [saving, setSaving] = useState(false)

  const toggleDate = (d) => {
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  const addCustomDate = () => {
    if (!customDate) return
    if (!selectedDates.includes(customDate)) setSelectedDates(prev => [...prev, customDate].sort())
    setCustomDate('')
  }

  const confirm = async () => {
    if (selectedDates.length === 0) { toast('Choisis au moins un jour'); return }
    setSaving(true)
    let anyError = false
    for (const date of selectedDates) {
      const { error } = await createRepasPlanifie({
        userId: user.id,
        date,
        meal,
        nom: source.nom,
        items: source.items,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
      })
      if (error) anyError = true
    }
    setSaving(false)
    if (anyError) toast('Erreur lors de la planification')
    else {
      toast(`✓ ${source.nom} planifié sur ${selectedDates.length} jour${selectedDates.length > 1 ? 's' : ''}`)
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
          Jour(s)
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => toggleDate(todayStr)} className="chip" style={selectedDates.includes(todayStr) ? { background: 'var(--green)', color: 'white' } : undefined}>
            Aujourd'hui
          </button>
          <button onClick={() => toggleDate(tomorrowStr)} className="chip" style={selectedDates.includes(tomorrowStr) ? { background: 'var(--green)', color: 'white' } : undefined}>
            Demain
          </button>
          <button onClick={() => toggleDate(afterTomorrowStr)} className="chip" style={selectedDates.includes(afterTomorrowStr) ? { background: 'var(--green)', color: 'white' } : undefined}>
            Après-demain
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input
            type="date"
            className="input"
            value={customDate}
            min={todayStr}
            onChange={e => setCustomDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={addCustomDate} className="btn-icon" style={{ background: 'var(--gray-bg)', flexShrink: 0 }} aria-label="Ajouter ce jour">
            <Plus size={18} color="var(--text-muted)" />
          </button>
        </div>

        {selectedDates.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {selectedDates.map(d => (
              <span key={d} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--green-light)', color: 'var(--green-dark)',
                borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
              }}>
                {new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                <button onClick={() => toggleDate(d)} style={{ color: 'var(--green-dark)', lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}

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

        <button className="btn-primary" onClick={confirm} disabled={saving || selectedDates.length === 0} style={{ opacity: saving || selectedDates.length === 0 ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Check size={16} />
          {saving ? 'Planification...' : `Planifier sur ${selectedDates.length} jour${selectedDates.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanMealModal — orchestrateur.
// Props :
//   presetSource — optionnel : { nom, items, sourceType, sourceId } déjà
//                  connu (ouverture depuis RecipeDetailModal ou RepasCard) →
//                  saute directement à l'étape "jour(s) + repas".
//   onClose()
//   onPlanned()  — appelé après une planification réussie (refresh calendrier)
// ─────────────────────────────────────────────────────────────────────────────
export default function PlanMealModal({ presetSource, defaultDate, onClose, onPlanned }) {
  const [step, setStep] = useState(presetSource ? 'schedule' : 'source')
  const [source, setSource] = useState(presetSource || null)

  // FoodPicker et AddFromRecipeModal appellent leur propre onClose() juste
  // après un onConfirm/onAdd réussi (pour se refermer eux-mêmes). Ici on ne
  // veut PAS fermer tout PlanMealModal dans ce cas, juste avancer à l'étape
  // suivante — d'où ce ref : on ne ferme réellement que si l'étape n'a pas
  // changé entre-temps (= annulation via X/retour, pas une validation).
  const stepRef = React.useRef(step)
  const goToStep = (s) => { stepRef.current = s; setStep(s) }
  const closeIfStillOn = (expectedStep) => () => { if (stepRef.current === expectedStep) onClose() }

  // ── Étape 0 : choix de la source ──────────────────────────────────────
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
        title="Planifier un aliment"
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

  // ── Étape finale : jour(s) + repas ─────────────────────────────────────
  return (
    <ScheduleStep
      source={source}
      defaultDate={defaultDate}
      onBack={presetSource ? null : () => setStep('source')}
      onClose={onClose}
      onPlanned={onPlanned}
    />
  )
}
