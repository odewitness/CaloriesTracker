import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'
import { useSettings } from '../hooks/useSettings'
import { useMeasurements } from '../hooks/useMeasurements'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import {
  User, Scale, Target, UtensilsCrossed, Droplet, Bell, Lightbulb,
  LogOut, ChevronRight, ChevronDown, Info, HeartPulse, Dumbbell, Camera,
} from 'lucide-react'
import { litres } from '../lib/water'
import Loader from '../components/Loader'
import Avatar from '../components/Avatar'
import { NavRow } from '../components/profile/primitives'
import InfosSection from '../components/profile/InfosSection'
import GoalsSection from '../components/profile/GoalsSection'
import MealSplitSection from '../components/profile/MealSplitSection'
import HydrationSection from '../components/profile/HydrationSection'
import NotificationsSection from '../components/profile/NotificationsSection'
import ComplementRemindersSection from '../components/profile/ComplementRemindersSection'
import TodaySection from '../components/profile/TodaySection'
import CycleSection from '../components/profile/CycleSection'
import SportSection from '../components/profile/SportSection'

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
  const { profile, loading: profileLoading, updateProfile, uploadAvatar, removeAvatar } = useProfile()
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings()
  const { entries: measurementEntries } = useMeasurements()
  const { supported: pushSupported, permission: pushPermission, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribePush } = usePushSubscription()

  // ── Navigation interne (hub ↔ écran de détail) ─────────────────────────────
  // section === null → le hub. Sinon on affiche l'écran correspondant.
  // Le bouton retour Android/navigateur est géré par useBackButton dans
  // SectionScreen : il ramène au hub avant de fermer l'overlay Profil.
  // `location.state.section` permet d'ouvrir directement un écran depuis
  // l'extérieur (ex. raccourci "Cycle" de DayShortcutsBar), sans passer par le
  // hub — lu une seule fois à l'ouverture de l'overlay.
  const [section, setSection] = useState(() => location.state?.section || null)

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

  // ── Photo de profil ─────────────────────────────────────────────────────
  const fileInputRef = useRef(null)
  const [avatarBusy, setAvatarBusy] = useState(false)

  const handlePickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier plus tard
    if (!file) return
    setAvatarBusy(true)
    const { error } = await uploadAvatar(file)
    setAvatarBusy(false)
    toast(error ? 'Impossible de mettre à jour la photo' : '✓ Photo mise à jour !')
  }

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true)
    const { error } = await removeAvatar()
    setAvatarBusy(false)
    toast(error ? 'Impossible de retirer la photo' : 'Photo retirée')
  }

  const [aboutOpen, setAboutOpen] = useState(false)

  if (profileLoading || settingsLoading || !goals) return <Loader />

  const displayName = (prenom || nom) ? `${prenom} ${nom}`.trim() : (user?.email || 'Mon profil')
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
        autoAdjustEnabled={settings?.goal_auto_adjust?.enabled === true}
        onToggleAutoAdjust={() => updateSettings({
          goal_auto_adjust: { ...settings?.goal_auto_adjust, enabled: !(settings?.goal_auto_adjust?.enabled === true) },
        })}
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
        complementsSummary={settings.notif_complements_enabled === false ? 'Désactivés' : 'Un ou plusieurs par complément'}
        onOpenComplementReminders={() => setSection('complements-rappels')}
        onBack={back}
      />
    )
  }

  if (section === 'complements-rappels') {
    return (
      <ComplementRemindersSection
        enabled={settings.notif_complements_enabled !== false}
        onToggleEnabled={() => updateSettings({ notif_complements_enabled: !(settings.notif_complements_enabled !== false) })}
        pushGranted={pushPermission === 'granted'}
        onBack={() => setSection('notifications')}
      />
    )
  }

  if (section === 'jour') {
    return (
      <TodaySection
        manquesEnabled={settings.afficher_manques_jour !== false}
        onToggleManques={() => updateSettings({ afficher_manques_jour: !(settings.afficher_manques_jour !== false) })}
        sectionsOrder={settings.ordre_sections_jour}
        onReorder={(next) => updateSettings({ ordre_sections_jour: next })}
        onBack={back}
      />
    )
  }

  if (section === 'cycle') {
    return (
      <CycleSection
        cycle={settings.cycle}
        onPatch={(patch) => updateSettings({ cycle: { ...settings.cycle, ...patch } })}
        onOpenInfo={() => navigate('/cycle-infos', { state: { backgroundLocation: location.state?.backgroundLocation || location } })}
        onBack={back}
      />
    )
  }

  if (section === 'sport') {
    return (
      <SportSection
        sport={settings.sport}
        goalKcal={goals.goal_kcal}
        profile={profile}
        weightKg={latestWeight}
        onPatch={(patch) => updateSettings({ sport: { ...settings.sport, ...patch } })}
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
  const sportSummary = settings.sport?.enabled ? 'Activé' : 'À activer'

  return (
    <div className="page-content">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', marginBottom: 10, opacity: avatarBusy ? 0.5 : 1 }}>
          <button
            onClick={() => !avatarBusy && fileInputRef.current?.click()}
            style={{ display: 'block', borderRadius: '50%', background: 'none', padding: 0 }}
            aria-label="Changer la photo de profil"
          >
            <Avatar userId={user?.id} name={displayName} size={72} version={profile?.avatar_updated_at} />
          </button>
          <button
            onClick={() => !avatarBusy && fileInputRef.current?.click()}
            style={{
              position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: '50%',
              background: 'var(--green)', color: 'white', border: '2px solid var(--gray-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Changer la photo de profil"
          >
            <Camera size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickAvatar}
            style={{ display: 'none' }}
          />
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{(prenom || nom) ? `${prenom} ${nom}`.trim() : 'Mon profil'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
        {profile?.avatar_updated_at && (
          <button
            onClick={handleRemoveAvatar}
            disabled={avatarBusy}
            style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-hint)', background: 'none' }}
          >
            Retirer la photo
          </button>
        )}
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
        <NavRow icon={<Dumbbell size={18} />} label="Sport" value={sportSummary} onClick={() => setSection('sport')} />
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
