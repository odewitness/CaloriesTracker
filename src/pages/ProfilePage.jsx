import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useSettings } from '../hooks/useSettings'
import { useMeasurements } from '../hooks/useMeasurements'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import {
  User, Scale, Target, UtensilsCrossed, Droplet, Bell, Lightbulb,
  LogOut, ChevronRight, ChevronDown, Info, HeartPulse,
} from 'lucide-react'
import { litres } from '../lib/water'
import Loader from '../components/Loader'
import { NavRow } from '../components/profile/primitives'
import InfosSection from '../components/profile/InfosSection'
import GoalsSection from '../components/profile/GoalsSection'
import MealSplitSection from '../components/profile/MealSplitSection'
import HydrationSection from '../components/profile/HydrationSection'
import NotificationsSection from '../components/profile/NotificationsSection'
import TodaySection from '../components/profile/TodaySection'
import CycleSection from '../components/profile/CycleSection'

// Champs de `settings` réellement pilotés par les écrans Objectifs / Répartition.
// `goals` est une copie figée de `settings` prise au chargement : ne renvoyer que
// ces clés à la sauvegarde évite d'écraser en base un changement fait entre-temps
// ailleurs (ex. un toggle notification) avec sa valeur périmée.
const GOAL_FIELDS = ['goal_kcal', 'goal_proteines', 'goal_glucides', 'goal_lipides', 'goal_fibres', 'meal_overrides', 'meal_enabled']

export default function ProfilePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { profile, loading: profileLoading, updateProfile } = useProfile()
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings()
  const { entries: measurementEntries } = useMeasurements()
  const { supported: pushSupported, permission: pushPermission, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribePush } = usePushSubscription()

  // ── Navigation interne (hub ↔ écran de détail) ─────────────────────────────
  // section === null → le hub. Sinon on affiche l'écran correspondant.
  // Le bouton retour Android/navigateur est géré par useBackButton dans
  // SectionScreen : il ramène au hub avant de fermer l'overlay Profil.
  const [section, setSection] = useState(null)

  const openMeasurements = () => navigate('/mensurations', { state: { backgroundLocation: location.state?.backgroundLocation || location } })
  const latestWeight = measurementEntries.find(e => e.poids_kg != null)?.poids_kg

  // ── Infos personnelles ────────────────────────────────────────────────────
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

  const SETTERS = { prenom: setPrenom, nom: setNom, age: setAge, sexe: setSexe, tailleCm: setTailleCm }
  const setInfoField = (field, value) => { SETTERS[field]?.(value); setProfileDirty(true) }

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

  // Le niveau d'activité ne se règle que depuis le calculateur (écran Objectifs) :
  // un choix unique parmi une liste → sauvegarde immédiate, comme les toggles,
  // plutôt que de traîner un état "à sauvegarder" dans un autre écran.
  const handleActivite = async (key) => {
    setNiveauActivite(key)
    await updateProfile({ niveau_activite: key })
  }

  // ── Objectifs nutritionnels ──────────────────────────────────────────────
  const [goals, setGoals] = useState(null)
  const [goalsDirty, setGoalsDirty] = useState(false)

  useEffect(() => {
    if (!settingsLoading && settings && !goals) setGoals({ ...settings })
  }, [settings, settingsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const setGoal = (k, v) => { setGoals(g => ({ ...g, [k]: v })); setGoalsDirty(true) }

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
    toast('✓ Objectifs mis à jour, pense à les enregistrer')
  }

  // ── Notifications ────────────────────────────────────────────────────────
  const [enablingPush, setEnablingPush] = useState(false)
  const handleEnablePush = async () => {
    setEnablingPush(true)
    const { error } = await subscribePush()
    setEnablingPush(false)
    if (error) toast(pushPermission === 'denied' ? 'Permission refusée' : "Impossible d'activer les notifications")
    else toast('✓ Notifications activées !')
  }

  const handleSignOut = async () => { await signOut() }

  const [aboutOpen, setAboutOpen] = useState(false)

  if (profileLoading || settingsLoading || !goals) return <Loader />

  const initials = ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || (user?.email?.[0] || '?').toUpperCase()
  const back = () => setSection(null)

  // ── Écrans de détail ─────────────────────────────────────────────────────
  if (section === 'infos') {
    return (
      <InfosSection
        prenom={prenom} nom={nom} age={age} sexe={sexe} tailleCm={tailleCm}
        onChange={setInfoField}
        dirty={profileDirty} saving={savingProfile} onSave={saveProfile}
        onBack={back}
      />
    )
  }

  if (section === 'objectifs') {
    return (
      <GoalsSection
        goals={goals} setGoal={setGoal}
        dirty={goalsDirty} saving={false} onSave={saveGoals}
        onBack={back}
        calc={{
          sexe, tailleCm, niveauActivite, onActivite: handleActivite,
          objective: calcObjective, onObjective: setCalcObjective,
          targetWeight: calcTargetWeight, onTargetWeight: setCalcTargetWeight,
          weeks: calcWeeks, onWeeks: setCalcWeeks,
          poidsKg: latestWeight, age,
          onOpenMeasurements: openMeasurements,
          onApply: applyCalorieNeeds,
        }}
      />
    )
  }

  if (section === 'repartition') {
    return (
      <MealSplitSection
        goals={goals} setGoals={setGoals} setGoalsDirty={setGoalsDirty}
        dirty={goalsDirty} saving={false} onSave={saveGoals}
        onBack={back}
      />
    )
  }

  if (section === 'hydratation') {
    return (
      <HydrationSection
        water={settings.water}
        onPatch={(patch) => updateSettings({ water: { ...settings.water, ...patch } })}
        weightKg={latestWeight}
        pushGranted={pushPermission === 'granted'}
        onBack={back}
      />
    )
  }

  if (section === 'notifications') {
    return (
      <NotificationsSection
        pushSupported={pushSupported}
        pushPermission={pushPermission}
        pushLoading={pushLoading}
        enablingPush={enablingPush}
        onEnablePush={handleEnablePush}
        reminderEnabled={settings.notif_reminder_enabled !== false}
        socialEnabled={settings.notif_social_enabled !== false}
        onToggleReminder={() => updateSettings({ notif_reminder_enabled: !(settings.notif_reminder_enabled !== false) })}
        onToggleSocial={() => updateSettings({ notif_social_enabled: !(settings.notif_social_enabled !== false) })}
        onBack={back}
      />
    )
  }

  if (section === 'jour') {
    return (
      <TodaySection
        manquesEnabled={settings.afficher_manques_jour !== false}
        onToggleManques={() => updateSettings({ afficher_manques_jour: !(settings.afficher_manques_jour !== false) })}
        onBack={back}
      />
    )
  }

  if (section === 'cycle') {
    return (
      <CycleSection
        cycle={settings.cycle}
        onPatch={(patch) => updateSettings({ cycle: { ...settings.cycle, ...patch } })}
        onBack={back}
      />
    )
  }

  // ── Hub ──────────────────────────────────────────────────────────────────
  const infosSummary = (age || tailleCm)
    ? [age && `${age} ans`, tailleCm && `${tailleCm} cm`].filter(Boolean).join(' · ')
    : 'À compléter'
  const repartitionCustom = Object.keys(goals.meal_overrides || {}).length > 0
    || Object.values(goals.meal_enabled || {}).some(v => v === false)
  const w = settings.water || {}
  const hydrationSummary = `${litres(w.goal_ml)} L/j`
  const notifSummary = pushPermission === 'granted'
    ? ((settings.notif_reminder_enabled !== false || settings.notif_social_enabled !== false) ? 'Activées' : 'Désactivées')
    : 'À activer'
  const jourSummary = settings.afficher_manques_jour !== false ? 'Manques affichés' : 'Manques masqués'
  const cycleSummary = settings.cycle?.enabled ? 'Activé' : 'À activer'

  return (
    <div className="page-content">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{prenom || nom ? `${prenom} ${nom}`.trim() : 'Mon profil'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
      </div>

      <div className="section-title">Profil &amp; objectifs</div>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <NavRow icon={<User size={18} />} label="Mes informations" value={infosSummary} onClick={() => setSection('infos')} />
        <NavRow icon={<Scale size={18} />} label="Poids & mensurations" value={latestWeight != null ? `${latestWeight} kg` : '—'} onClick={openMeasurements} />
        <NavRow icon={<Target size={18} />} label="Objectifs nutritionnels" value={`${goals.goal_kcal} kcal`} onClick={() => setSection('objectifs')} />
        <NavRow icon={<UtensilsCrossed size={18} />} label="Répartition par repas" value={repartitionCustom ? 'Personnalisée' : 'Automatique'} onClick={() => setSection('repartition')} />
      </div>

      <div className="section-title">Rappels &amp; affichage</div>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <NavRow icon={<Droplet size={18} />} label="Hydratation" value={hydrationSummary} onClick={() => setSection('hydratation')} />
        <NavRow icon={<HeartPulse size={18} />} label="Cycle & alimentation" value={cycleSummary} onClick={() => setSection('cycle')} />
        <NavRow icon={<Bell size={18} />} label="Notifications" value={notifSummary} onClick={() => setSection('notifications')} />
        <NavRow icon={<Lightbulb size={18} />} label="Page du jour" value={jourSummary} onClick={() => setSection('jour')} />
      </div>

      <button
        onClick={handleSignOut}
        className="card"
        style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--coral)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, marginBottom: 20 }}
      >
        <LogOut size={18} />
        Se déconnecter
      </button>

      <div className="card" style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setAboutOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', fontFamily: 'var(--font)', textAlign: 'left', background: 'none' }}
        >
          <Info size={18} color="var(--text-hint)" />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>À propos</div>
          <span style={{ fontSize: 12.5, color: 'var(--text-hint)' }}>v1.0.0</span>
          {aboutOpen ? <ChevronDown size={16} color="var(--text-hint)" /> : <ChevronRight size={16} color="var(--text-hint)" />}
        </button>
        {aboutOpen && (
          <div style={{ padding: '0 16px 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Données nutritionnelles : <strong>Table Ciqual 2025</strong> (ANSES) + <strong>Open Food Facts</strong><br />
            Base de données : <strong>Supabase</strong>
          </div>
        )}
      </div>
    </div>
  )
}
