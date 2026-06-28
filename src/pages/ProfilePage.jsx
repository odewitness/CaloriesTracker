import React, { useState, useEffect, useMemo } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { User, Calendar, Scale, Mail, LogOut, Target, Flame, Dumbbell, Wheat, Droplets, Leaf, Coffee, Sun, Moon, Cookie, RotateCcw, Pill } from 'lucide-react'
import { computeMealTargets, MEALS_ORDER, MEAL_ENABLED_DEFAULTS } from '../lib/nutrients'

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
    if (!settingsLoading && settings && !goals) setGoals({ ...settings })
    }, [settings, settingsLoading])

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