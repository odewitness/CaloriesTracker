import React, { useState, useEffect, useMemo } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { User, Calendar, Scale, Mail, LogOut, Target, Flame, Dumbbell, Wheat, Droplets, Leaf, Coffee, Sun, Moon, Cookie, RotateCcw } from 'lucide-react'
import { computeMealTargets, MEALS_ORDER } from '../lib/nutrients'

const MEAL_ICONS = { 'Petit-déjeuner': Coffee, 'Déjeuner': Sun, 'Dîner': Moon, 'Collation': Cookie }

const PRESETS = [
  { label: 'Perte de poids (femme)', kcal: 1400, prot: 100, gluc: 130, lip: 50, fib: 30 },
  { label: 'Perte de poids (homme)', kcal: 1700, prot: 130, gluc: 160, lip: 60, fib: 35 },
  { label: 'Maintien (femme)',        kcal: 1900, prot: 90,  gluc: 210, lip: 70, fib: 30 },
  { label: 'Maintien (homme)',        kcal: 2400, prot: 110, gluc: 270, lip: 85, fib: 35 },
  { label: 'Prise de muscle (homme)', kcal: 2800, prot: 170, gluc: 320, lip: 90, fib: 35 },
]

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      <div style={{ color: 'var(--green)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14 }}>{label}</div>
      {children}
    </div>
  )
}

function GoalField({ icon, label, value, unit, color, onChange }) {
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
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          style={{ width: 72, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', color, background: 'var(--gray-bg)', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{unit}</span>
      </div>
    </div>
  )
}

function MealTargetCard({ meal, target, onChange, onReset }) {
  const Icon = MEAL_ICONS[meal]
  const hasOverride = !target.isAuto.kcal || !target.isAuto.prot || !target.isAuto.gluc || !target.isAuto.lip

  const field = (key, label, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input
        type="number"
        value={target[key]}
        onChange={e => onChange(key, e.target.value)}
        style={{
          width: 56, textAlign: 'center', border: `1px solid ${target.isAuto[key] ? 'var(--border)' : color}`,
          borderRadius: 6, padding: '6px 4px', fontSize: 13, fontWeight: 700, color,
          background: target.isAuto[key] ? 'var(--gray-bg)' : 'var(--white)', fontFamily: 'var(--font)', outline: 'none',
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {Icon && <Icon size={15} color="var(--green)" />}
          <div style={{ fontWeight: 700, fontSize: 13 }}>{meal}</div>
        </div>
        {hasOverride && (
          <button onClick={onReset} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-hint)', fontFamily: 'var(--font)' }}>
            <RotateCcw size={12} /> Auto
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {field('kcal', 'kcal', 'var(--text)')}
        {field('prot', 'Prot.', 'var(--green)')}
        {field('gluc', 'Gluc.', 'var(--amber)')}
        {field('lip',  'Lip.',  'var(--coral)')}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const toast = useToast()
  const { user, signOut } = useAuth()
  const { profile, loading: profileLoading, updateProfile } = useProfile()
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings()

  // ── Infos personnelles ──────────────────────────────────────────────────
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [age, setAge] = useState('')
  const [poids, setPoids] = useState('')
  const [profileDirty, setProfileDirty] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (profile) {
      setPrenom(profile.prenom || '')
      setNom(profile.nom || '')
      setAge(profile.age ?? '')
      setPoids(profile.poids_kg ?? '')
    }
  }, [profile])

  const markProfileDirty = (setter) => (v) => { setter(v); setProfileDirty(true) }

  const saveProfile = async () => {
    setSavingProfile(true)
    const { error } = await updateProfile({
      prenom: prenom.trim() || null,
      nom: nom.trim() || null,
      age: age !== '' ? parseInt(age) : null,
      poids_kg: poids !== '' ? parseFloat(poids) : null,
    })
    setSavingProfile(false)
    if (!error) { toast('✓ Profil mis à jour !'); setProfileDirty(false) }
    else toast('Erreur lors de la sauvegarde')
  }

  // ── Objectifs nutritionnels ─────────────────────────────────────────────
  const [goals, setGoals] = useState(null)
  const [goalsDirty, setGoalsDirty] = useState(false)

  useEffect(() => {
    if (settings && !goals) setGoals({ ...settings })
  }, [settings])

  const setGoal = (k, v) => { setGoals(g => ({ ...g, [k]: v })); setGoalsDirty(true) }

  const saveGoals = async () => {
    await updateSettings(goals)
    setGoalsDirty(false)
    toast('✓ Objectifs sauvegardés !')
  }

  const applyPreset = (p) => {
    setGoals(g => ({ ...g, goal_kcal: p.kcal, goal_proteines: p.prot, goal_glucides: p.gluc, goal_lipides: p.lip, goal_fibres: p.fib }))
    setGoalsDirty(true)
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

  const handleSignOut = async () => {
    await signOut()
  }

  if (profileLoading || settingsLoading || !goals) return <div className="loader"><div className="spinner" /> Chargement...</div>

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
        <Row icon={<Scale size={18} />} label="Poids (kg)">
          <input className="input-sm" type="number" step="0.1" value={poids} onChange={e => markProfileDirty(setPoids)(e.target.value)} placeholder="—" />
        </Row>
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

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.label} className="chip" onClick={() => applyPreset(p)} style={{ fontSize: 11 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

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
          onChange={(key, val) => setMealOverride(meal, key, val)}
          onReset={() => resetMealOverrides(meal)}
        />
      ))}

      {goalsDirty && (
        <button className="btn-primary" onClick={saveGoals} style={{ marginTop: 4, marginBottom: 20 }}>💾 Sauvegarder les objectifs</button>
      )}

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