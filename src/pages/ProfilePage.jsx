import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useSettings } from '../hooks/useSettings'
import { useMeasurements } from '../hooks/useMeasurements'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { User, Calendar, Scale, Ruler, Mail, LogOut, Target, Flame, Dumbbell, Wheat, Droplets, Leaf, Coffee, Sun, Moon, Cookie, RotateCcw, Pill, ChevronRight, Bell, Users, Calculator } from 'lucide-react'
import { computeMealTargets, MEALS_ORDER, MEAL_ENABLED_DEFAULTS, computeCalorieNeeds, ACTIVITY_LEVELS, CALORIE_OBJECTIVES } from '../lib/nutrients'
import Loader from '../components/Loader'

const MEAL_ICONS = { 'Petit-déjeuner': Coffee, 'Déjeuner': Sun, 'Dîner': Moon, 'Collation': Cookie }

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      <div style={{ color: 'var(--green)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14 }}>{label}</div>
      {children}
    </div>
  )
}

function ToggleSwitch({ checked, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
        background: checked ? 'var(--green)' : 'var(--border-md)',
        transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

function GoalField({ icon, label, value, unit, color, onChange }) {
  // Buffer texte local : évite qu'effacer le champ pour taper une nouvelle
  // valeur ne le fasse passer furtivement par 0 (voir CLAUDE.md / historique).
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    setText(v)
    if (v === '') return // en cours d'effacement, ne pas forcer 0 tant que rien n'est retapé
    const num = parseInt(v, 10)
    if (!isNaN(num)) onChange(num)
  }

  const handleBlur = () => {
    // Champ laissé vide ou invalide au blur : revient à la dernière valeur valide
    if (text === '' || isNaN(parseInt(text, 10))) setText(String(value))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Objectif quotidien</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{ width: 72, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', color, background: 'var(--gray-bg)', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{unit}</span>
      </div>
    </div>
  )
}

function CalorieCalculatorCard({ sexe, tailleCm, niveauActivite, onActivite, objective, onObjective, targetWeight, onTargetWeight, weeks, onWeeks, poidsKg, age, onOpenMeasurements, onApply }) {
  const missing = []
  if (!sexe) missing.push('sexe')
  if (!age) missing.push('âge')
  if (!tailleCm) missing.push('taille')
  if (!poidsKg) missing.push('poids')
  const missingLabel = missing.length > 1
    ? missing.slice(0, -1).join(', ') + ' et ' + missing[missing.length - 1]
    : missing[0]

  const needsWeightGoal = objective !== 'maintien'
  const objectiveWeightKg = targetWeight ? parseFloat(targetWeight) : null
  const objectiveWeeks = weeks ? parseFloat(weeks) : null

  // Pour la perte, le poids objectif doit être inférieur au poids actuel (et
  // inversement pour la prise) — sinon le calcul donnerait un ajustement dans
  // le mauvais sens (ex. un surplus alors qu'on a choisi « Perte de poids »).
  const wrongDirection = needsWeightGoal && poidsKg != null && objectiveWeightKg != null && (
    (objective === 'perte' && objectiveWeightKg >= poidsKg) ||
    (objective === 'prise' && objectiveWeightKg <= poidsKg)
  )

  const needs = wrongDirection ? null : computeCalorieNeeds({
    sexe,
    age: age ? parseInt(age, 10) : null,
    tailleCm: tailleCm ? parseFloat(tailleCm) : null,
    poidsKg,
    activityKey: niveauActivite,
    objectiveKey: objective,
    objectiveWeightKg: needsWeightGoal ? objectiveWeightKg : null,
    objectiveWeeks: needsWeightGoal ? objectiveWeeks : null,
  })

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Calculator size={16} color="var(--green)" />
        <div style={{ fontWeight: 700, fontSize: 14 }}>Calculateur de besoins caloriques</div>
      </div>

      {missing.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 12, lineHeight: 1.5 }}>
          Il manque : {missingLabel}, pour voir l'estimation (sexe, âge et taille se règlent dans tes informations personnelles ci-dessus).
        </div>
      )}

      <div onClick={onOpenMeasurements} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: 'pointer' }}>
        <div style={{ flex: 1, fontSize: 13 }}>Poids</div>
        <span style={{ fontSize: 13, color: poidsKg != null ? 'var(--text)' : 'var(--coral)', fontWeight: 600 }}>
          {poidsKg != null ? `${poidsKg} kg` : 'à renseigner'}
        </span>
        <ChevronRight size={14} color="var(--text-hint)" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>Niveau d'activité</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACTIVITY_LEVELS.map(a => (
            <button key={a.key} onClick={() => onActivite(a.key)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontFamily: 'var(--font)',
              border: `1.5px solid ${niveauActivite === a.key ? 'var(--green)' : 'var(--border)'}`,
              background: niveauActivite === a.key ? 'var(--green-light)' : 'var(--white)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: niveauActivite === a.key ? 'var(--green-dark)' : 'var(--text)' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: needsWeightGoal ? 10 : 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>Objectif</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CALORIE_OBJECTIVES.map(o => (
            <button key={o.key} onClick={() => onObjective(o.key)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
              background: objective === o.key ? 'var(--green)' : 'var(--green-light)',
              color: objective === o.key ? 'white' : 'var(--green-dark)',
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {needsWeightGoal && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Poids objectif</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" value={targetWeight} onChange={e => onTargetWeight(e.target.value)} placeholder="—"
                style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>En combien de temps</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" value={weeks} onChange={e => onWeeks(e.target.value)} placeholder="—"
                style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>sem.</span>
            </div>
          </div>
        </div>
      )}

      {wrongDirection && (
        <div style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 12, lineHeight: 1.5 }}>
          {objective === 'perte'
            ? 'Ton poids objectif doit être inférieur à ton poids actuel pour une perte de poids.'
            : 'Ton poids objectif doit être supérieur à ton poids actuel pour une prise de muscle.'}
        </div>
      )}

      {needs && needs.macros ? (
        <div style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Métabolisme de base : <strong style={{ color: 'var(--text)' }}>{needs.bmr} kcal</strong></div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Dépense totale (maintien) : <strong style={{ color: 'var(--text)' }}>{needs.tdee} kcal</strong></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--coral)', marginTop: 6 }}>
            Objectif estimé : {needs.targetKcal} kcal/jour
          </div>
          {needs.paceKgPerWeek != null && (
            <div style={{ fontSize: 11, color: needs.unsafePace ? 'var(--coral)' : 'var(--text-hint)', marginTop: 2 }}>
              Rythme : ≈ {needs.paceKgPerWeek > 0 ? '+' : ''}{needs.paceKgPerWeek.toFixed(2)} kg/semaine
              {needs.unsafePace && (objective === 'perte'
                ? ' — plus rapide que recommandé (max ~1 kg/semaine), risque de fonte musculaire et de reprise'
                : ' — plus rapide que recommandé (max ~0,5 kg/semaine), au-delà c\'est surtout du gras')}
            </div>
          )}
        </div>
      ) : (missing.length === 0 && needsWeightGoal && !wrongDirection && (!targetWeight || !weeks)) ? (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 12, lineHeight: 1.5 }}>
          Renseigne ton poids objectif et la durée pour voir l'estimation.
        </div>
      ) : null}

      <button className="btn-primary" disabled={!needs || !needs.macros} onClick={() => onApply(needs)} style={{ opacity: (needs && needs.macros) ? 1 : 0.5 }}>
        Appliquer ces valeurs aux objectifs
      </button>
    </div>
  )
}

function MealTargetCard({ meal, target, allTargets, goalKcal, onChange, onReset, onToggleEnabled }) {
  const Icon = MEAL_ICONS[meal]
  const hasOverride = target.enabled && (!target.isAuto.kcal || !target.isAuto.prot || !target.isAuto.gluc || !target.isAuto.lip)

  // Total des kcal attribuées = somme de tous les repas actifs
  const totalAllocated = Object.values(allTargets).reduce((s, t) => s + (t.enabled ? t.kcal : 0), 0)
  const kcalRemaining = goalKcal - totalAllocated

  const field = (key, label, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input
        type="number"
        value={target[key]}
        disabled={!target.enabled}
        onChange={e => onChange(key, e.target.value)}
        style={{
          width: 56, textAlign: 'center',
          border: `1.5px solid ${!target.enabled ? 'var(--border)' : target.isAuto[key] ? 'var(--border)' : color}`,
          borderRadius: 6, padding: '6px 4px', fontSize: 13, fontWeight: 700,
          color: !target.enabled ? 'var(--text-hint)' : color,
          background: !target.enabled ? 'var(--gray-bg)' : target.isAuto[key] ? 'var(--gray-bg)' : 'var(--white)',
          fontFamily: 'var(--font)', outline: 'none', opacity: target.enabled ? 1 : 0.5,
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 8, opacity: target.enabled ? 1 : 0.6, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: target.enabled ? 9 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {Icon && <Icon size={15} color={target.enabled ? 'var(--green)' : 'var(--text-hint)'} />}
          <div style={{ fontWeight: 700, fontSize: 13, color: target.enabled ? 'var(--text)' : 'var(--text-hint)' }}>{meal}</div>
          {!target.enabled && (
            <span style={{ fontSize: 10, color: 'var(--text-hint)', background: 'var(--gray-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>désactivé</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasOverride && target.enabled && (
            <button onClick={onReset} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-hint)', fontFamily: 'var(--font)' }}>
              <RotateCcw size={11} /> Auto
            </button>
          )}
          {/* Toggle actif/inactif */}
          <button
            onClick={onToggleEnabled}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
              background: target.enabled ? 'var(--green)' : 'var(--border-md)',
              transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: target.enabled ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      </div>

      {target.enabled && (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {field('kcal', 'kcal', 'var(--text)')}
            {field('prot', 'Prot.', 'var(--green)')}
            {field('gluc', 'Gluc.', 'var(--amber)')}
            {field('lip',  'Lip.',  'var(--coral)')}
          </div>
          {!target.isAuto.kcal && (
            <div style={{ marginTop: 7, fontSize: 11, color: Math.abs(kcalRemaining) < 2 ? 'var(--green)' : kcalRemaining < 0 ? 'var(--coral)' : 'var(--amber)' }}>
              {Math.abs(kcalRemaining) < 2
                ? '✓ Budget calorique équilibré'
                : kcalRemaining < 0
                  ? `⚠ ${Math.abs(Math.round(kcalRemaining))} kcal en trop au total`
                  : `${Math.round(kcalRemaining)} kcal non attribuées (réparties automatiquement)`}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { profile, loading: profileLoading, updateProfile } = useProfile()
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings()
  const { entries: measurementEntries } = useMeasurements()
  const { supported: pushSupported, permission: pushPermission, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribePush } = usePushSubscription()

  // Les préférences de notification s'appliquent immédiatement (pas de bouton
  // "Sauvegarder") — contrairement aux objectifs nutritionnels, ce ne sont
  // pas des valeurs qu'on ajuste plusieurs fois avant de valider.
  const [enablingPush, setEnablingPush] = useState(false)
  const handleEnablePush = async () => {
    setEnablingPush(true)
    const { error } = await subscribePush()
    setEnablingPush(false)
    if (error) toast(pushPermission === 'denied' ? 'Permission refusée' : "Impossible d'activer les notifications")
    else toast('✓ Notifications activées !')
  }

  const openMeasurements = () => navigate('/mensurations', { state: { backgroundLocation: location.state?.backgroundLocation || location } })
  const latestWeight = measurementEntries.find(e => e.poids_kg != null)?.poids_kg

  // ── Infos personnelles ──────────────────────────────────────────────────
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [age, setAge] = useState('')
  const [sexe, setSexe] = useState('')
  const [tailleCm, setTailleCm] = useState('')
  const [niveauActivite, setNiveauActivite] = useState('')
  const [calcObjective, setCalcObjective] = useState('maintien')
  const [calcTargetWeight, setCalcTargetWeight] = useState('')
  const [calcWeeks, setCalcWeeks] = useState('')
  const [profileDirty, setProfileDirty] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (profile) {
      setPrenom(profile.prenom || '')
      setNom(profile.nom || '')
      setAge(profile.age ?? '')
      setSexe(profile.sexe || '')
      setTailleCm(profile.taille_cm ?? '')
      setNiveauActivite(profile.niveau_activite || '')
    }
  }, [profile])

  const markProfileDirty = (setter) => (v) => { setter(v); setProfileDirty(true) }

  const saveProfile = async () => {
    setSavingProfile(true)
    const { error } = await updateProfile({
      prenom: prenom.trim() || null,
      nom: nom.trim() || null,
      age: age !== '' ? parseInt(age) : null,
      sexe: sexe || null,
      taille_cm: tailleCm !== '' ? parseFloat(tailleCm) : null,
      niveau_activite: niveauActivite || null,
    })
    setSavingProfile(false)
    if (!error) { toast('✓ Profil mis à jour !'); setProfileDirty(false) }
    else toast('Erreur lors de la sauvegarde')
  }

  // ── Objectifs nutritionnels ─────────────────────────────────────────────
  const [goals, setGoals] = useState(null)
  const [goalsDirty, setGoalsDirty] = useState(false)

  useEffect(() => {
    if (!settingsLoading && settings && !goals) setGoals({ ...settings })
    }, [settings, settingsLoading])

  const setGoal = (k, v) => { setGoals(g => ({ ...g, [k]: v })); setGoalsDirty(true) }

  // Champs réellement gérés par cette section. `goals` est une copie figée de
  // `settings` prise au chargement de la page : si on renvoyait l'objet entier
  // à la sauvegarde, on écraserait en base tout changement fait entre-temps
  // ailleurs sur la page (ex. toggle notification), avec sa valeur périmée.
  const GOAL_FIELDS = ['goal_kcal', 'goal_proteines', 'goal_glucides', 'goal_lipides', 'goal_fibres', 'meal_overrides', 'meal_enabled']

  const saveGoals = async () => {
    const patch = {}
    for (const k of GOAL_FIELDS) patch[k] = goals[k]
    await updateSettings(patch)
    setGoalsDirty(false)
    toast('✓ Objectifs sauvegardés !')
  }

  const applyCalorieNeeds = (needs) => {
    if (!needs) return
    setGoals(g => ({ ...g, ...needs.macros }))
    setGoalsDirty(true)
    toast('✓ Objectifs mis à jour, pense à les sauvegarder ci-dessous')
  }

  // ── Répartition par repas (auto basé sur la science, surchargeable) ────
  const mealTargets = useMemo(() => computeMealTargets(goals), [goals])

  const setMealOverride = (meal, key, rawValue) => {
    setGoals(g => {
      const overrides = { ...(g.meal_overrides || {}) }
      const mealOv = { ...(overrides[meal] || {}) }
      if (rawValue === '') {
        delete mealOv[key]
      } else {
        const num = parseFloat(rawValue)
        if (!isNaN(num)) mealOv[key] = num
      }
      if (Object.keys(mealOv).length === 0) delete overrides[meal]
      else overrides[meal] = mealOv
      return { ...g, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const resetMealOverrides = (meal) => {
    setGoals(g => {
      const overrides = { ...(g.meal_overrides || {}) }
      delete overrides[meal]
      return { ...g, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const toggleMealEnabled = (meal) => {
    setGoals(g => {
      const enabled = { ...MEAL_ENABLED_DEFAULTS, ...(g.meal_enabled || {}) }
      enabled[meal] = !enabled[meal]
      // Quand on désactive, on purge les surcharges pour rendre le budget aux repas auto actifs
      const overrides = { ...(g.meal_overrides || {}) }
      if (!enabled[meal]) delete overrides[meal]
      return { ...g, meal_enabled: enabled, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (profileLoading || settingsLoading || !goals) return <Loader />

  const initials = ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || (user?.email?.[0] || '?').toUpperCase()

  return (
    <div className="page-content">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{prenom || nom ? `${prenom} ${nom}`.trim() : 'Mon profil'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
      </div>

      <div className="section-title">Informations personnelles</div>
      <div className="card" style={{ marginBottom: profileDirty ? 12 : 20, overflow: 'hidden' }}>
        <Row icon={<User size={18} />} label="Prénom">
          <input className="input-sm" style={{ width: 120, textAlign: 'left' }} value={prenom} onChange={e => markProfileDirty(setPrenom)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<User size={18} />} label="Nom">
          <input className="input-sm" style={{ width: 120, textAlign: 'left' }} value={nom} onChange={e => markProfileDirty(setNom)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<Calendar size={18} />} label="Âge">
          <input className="input-sm" type="number" value={age} onChange={e => markProfileDirty(setAge)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<User size={18} />} label="Sexe">
          <div style={{ display: 'flex', gap: 4 }}>
            {[['F', 'Femme'], ['H', 'Homme']].map(([key, label]) => (
              <button key={key} onClick={() => markProfileDirty(setSexe)(key)} style={{
                padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
                background: sexe === key ? 'var(--green)' : 'var(--gray-bg)',
                color: sexe === key ? 'white' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
                {label}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={<Ruler size={18} />} label="Taille">
          <input className="input-sm" type="number" style={{ width: 64 }} value={tailleCm} onChange={e => markProfileDirty(setTailleCm)(e.target.value)} placeholder="—" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>cm</span>
        </Row>
        <div
          onClick={openMeasurements}
          style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12, cursor: 'pointer' }}
        >
          <div style={{ color: 'var(--green)', flexShrink: 0 }}><Scale size={18} /></div>
          <div style={{ flex: 1, fontSize: 14 }}>Poids & mensurations</div>
          <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>{latestWeight != null ? `${latestWeight} kg` : '—'}</div>
          <ChevronRight size={16} color="var(--text-hint)" />
        </div>
        <Row icon={<Mail size={18} />} label="Email">
          <span style={{ fontSize: 13, color: 'var(--text-hint)' }}>{user?.email}</span>
        </Row>
      </div>

      {profileDirty && (
        <button className="btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ marginBottom: 20, opacity: savingProfile ? 0.7 : 1 }}>
          {savingProfile ? 'Sauvegarde...' : '💾 Sauvegarder le profil'}
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Target size={16} color="var(--green)" />
        <div className="section-title" style={{ marginBottom: 0 }}>Objectifs nutritionnels</div>
      </div>

      <CalorieCalculatorCard
        sexe={sexe}
        tailleCm={tailleCm}
        niveauActivite={niveauActivite}
        onActivite={markProfileDirty(setNiveauActivite)}
        objective={calcObjective}
        onObjective={setCalcObjective}
        targetWeight={calcTargetWeight}
        onTargetWeight={setCalcTargetWeight}
        weeks={calcWeeks}
        onWeeks={setCalcWeeks}
        poidsKg={latestWeight}
        age={age}
        onOpenMeasurements={openMeasurements}
        onApply={applyCalorieNeeds}
      />

      <div className="card" style={{ marginBottom: goalsDirty ? 12 : 20, overflow: 'hidden' }}>
        <GoalField icon={<Flame size={18} />}    label="Calories"   value={goals.goal_kcal}      unit="kcal" color="var(--coral)"  onChange={v => setGoal('goal_kcal', v)} />
        <GoalField icon={<Dumbbell size={18} />} label="Protéines"  value={goals.goal_proteines} unit="g"    color="var(--green)"  onChange={v => setGoal('goal_proteines', v)} />
        <GoalField icon={<Wheat size={18} />}    label="Glucides"   value={goals.goal_glucides}  unit="g"    color="var(--amber)"  onChange={v => setGoal('goal_glucides', v)} />
        <GoalField icon={<Droplets size={18} />} label="Lipides"    value={goals.goal_lipides}   unit="g"    color="var(--coral)"  onChange={v => setGoal('goal_lipides', v)} />
        <GoalField icon={<Leaf size={18} />}     label="Fibres"     value={goals.goal_fibres}    unit="g"    color="var(--blue)"   onChange={v => setGoal('goal_fibres', v)} />
      </div>

      {goalsDirty && (
        <button className="btn-primary" onClick={saveGoals} style={{ marginBottom: 20 }}>💾 Sauvegarder les objectifs</button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Target size={16} color="var(--green)" />
        <div className="section-title" style={{ marginBottom: 0 }}>Répartition par repas</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 10 }}>
        Calculée automatiquement à partir de tes objectifs ci-dessus (calories réparties selon les repères nutritionnels usuels, protéines réparties à parts égales entre les 3 repas principaux pour mieux soutenir la synthèse musculaire). Modifie une valeur pour la fixer manuellement, ou appuie sur « Auto » pour revenir au calcul automatique.
      </div>

      {MEALS_ORDER.map(meal => (
        <MealTargetCard
          key={meal}
          meal={meal}
          target={mealTargets[meal]}
          allTargets={mealTargets}
          goalKcal={goals.goal_kcal}
          onChange={(key, val) => setMealOverride(meal, key, val)}
          onReset={() => resetMealOverrides(meal)}
          onToggleEnabled={() => toggleMealEnabled(meal)}
        />
      ))}

      {/* Toggle Compléments alimentaires — pas un repas, pas de calcul kcal/macros */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 8, opacity: goals.meal_enabled?.['Compléments'] !== false ? 1 : 0.6, transition: 'opacity .2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Pill size={15} color={goals.meal_enabled?.['Compléments'] !== false ? 'var(--purple, #8b5cf6)' : 'var(--text-hint)'} />
            <div style={{ fontWeight: 700, fontSize: 13, color: goals.meal_enabled?.['Compléments'] !== false ? 'var(--text)' : 'var(--text-hint)' }}>
              Compléments
            </div>
            {goals.meal_enabled?.['Compléments'] === false && (
              <span style={{ fontSize: 10, color: 'var(--text-hint)', background: 'var(--gray-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>désactivé</span>
            )}
          </div>
          <button
            onClick={() => toggleMealEnabled('Compléments')}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
              background: goals.meal_enabled?.['Compléments'] !== false ? 'var(--green)' : 'var(--border-md)',
              transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2,
              left: goals.meal_enabled?.['Compléments'] !== false ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      </div>

      {goalsDirty && (
        <button className="btn-primary" onClick={saveGoals} style={{ marginTop: 4, marginBottom: 20 }}>💾 Sauvegarder les objectifs</button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Bell size={16} color="var(--green)" />
        <div className="section-title" style={{ marginBottom: 0 }}>Notifications</div>
      </div>

      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {!pushSupported ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--text-hint)' }}>
            Non disponible sur ce navigateur.
          </div>
        ) : pushPermission !== 'granted' ? (
          <div style={{ padding: '13px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Reçois un rappel si tu n'as rien noté, et sois prévenue de l'activité de tes amies. Fonctionne mieux si l'app est ajoutée à l'écran d'accueil.
            </div>
            <button className="btn-primary" onClick={handleEnablePush} disabled={enablingPush || pushLoading}>
              {enablingPush ? '...' : 'Activer les notifications'}
            </button>
            {pushPermission === 'denied' && (
              <div style={{ fontSize: 12, color: 'var(--coral)', marginTop: 8 }}>
                Permission refusée — à réactiver dans les réglages du navigateur pour ce site.
              </div>
            )}
          </div>
        ) : (
          <>
            <Row icon={<Bell size={18} />} label="Rappel si rien noté">
              <ToggleSwitch
                checked={settings.notif_reminder_enabled !== false}
                onClick={() => updateSettings({ notif_reminder_enabled: !(settings.notif_reminder_enabled !== false) })}
              />
            </Row>
            <Row icon={<Users size={18} />} label="Activité sociale">
              <ToggleSwitch
                checked={settings.notif_social_enabled !== false}
                onClick={() => updateSettings({ notif_social_enabled: !(settings.notif_social_enabled !== false) })}
              />
            </Row>
          </>
        )}
      </div>

      <button
        onClick={handleSignOut}
        className="card"
        style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--coral)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}
      >
        <LogOut size={18} />
        Se déconnecter
      </button>

      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="section-title">À propos</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Données nutritionnelles : <strong>Table Ciqual 2025</strong> (ANSES) + <strong>Open Food Facts</strong><br/>
          Base de données : <strong>Supabase</strong><br/>
          Version : 1.0.0
        </div>
      </div>
    </div>
  )
}