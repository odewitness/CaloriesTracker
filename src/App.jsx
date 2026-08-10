import React, { useState, useEffect, useRef } from 'react'
import { ToastProvider } from './lib/toast'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useProfile } from './hooks/useProfile'
import AuthPage from './pages/AuthPage'
import TodayPage from './pages/TodayPage'
import ManualPage from './pages/ManualPage'
import ShoppingListPage from './pages/ShoppingListPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import CalendarPage from './pages/CalendarPage'

const TABS = [
  { id: 'today',    label: "Aujourd'hui", icon: HomeIcon },
  { id: 'manual',   label: 'Mes aliments', icon: PencilIcon },
  { id: 'courses',  label: 'Courses',     icon: CartIcon },
  { id: 'history',  label: 'Historique',  icon: ChartIcon },
]

function HomeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function PencilIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CartIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
}

function ChartIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}

// Icône de secours pour le bouton profil (utilisée quand on n'a pas encore
// de prénom/nom pour afficher des initiales).
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

function CalendarButtonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

// Bouton rond en haut à droite : ouvre ProfilePage en plein écran par-dessus
// l'app, sans occuper d'onglet dans la bottom nav.
// hidden=true → le bandeau se rétracte (scroll vers le bas), voir handleScroll.
function ProfileButton({ onClick, onCalendarClick, hidden }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const initials = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()
    || (user?.email?.[0] || '').toUpperCase()

  return (
    <div className={`top-bar${hidden ? ' top-bar-hidden' : ''}`}>
      <button className="profile-avatar-btn" onClick={onCalendarClick} aria-label="Calendrier">
        <CalendarButtonIcon />
      </button>
      <button className="profile-avatar-btn" onClick={onClick} aria-label="Profil">
        {initials ? initials : <ProfileIcon />}
      </button>
    </div>
  )
}

function AppShell() {
  const [tab, setTab] = useState('today')
  const [profileOpen, setProfileOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Header qui se cache au scroll vers le bas, réapparaît vers le haut (ou
  // en haut de page). onScrollCapture sur le conteneur des pages permet de
  // détecter le scroll même si c'est le .page-content d'une page enfant qui
  // scrolle réellement (le scroll ne "bubble" pas nativement en DOM, mais
  // React capture les events des descendants avec onScrollCapture).
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollTop = useRef(0)

  // On repart d'un header visible et d'un scroll à 0 à chaque changement
  // d'onglet, pour éviter un état incohérent avec la position de scroll
  // de la nouvelle page.
  useEffect(() => {
    setHeaderHidden(false)
    lastScrollTop.current = 0
  }, [tab])

  const handleScroll = (e) => {
    const top = e.target.scrollTop
    const delta = top - lastScrollTop.current
    if (top <= 4) setHeaderHidden(false)        // tout en haut → toujours visible
    else if (delta > 6) setHeaderHidden(true)    // scroll vers le bas → se cache
    else if (delta < -6) setHeaderHidden(false)  // scroll vers le haut → réapparaît
    lastScrollTop.current = top
  }

  // Retour Android : pousse une entrée à chaque changement d'onglet,
  // et écoute popstate pour revenir à 'today' — sans jamais appeler history.back() au cleanup.
  useEffect(() => {
    if (tab === 'today') return

    history.pushState({ tab }, '')

    const handlePop = () => setTab('today')
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [tab])

  // Le profil suit la même logique de retour Android : une ouverture pousse
  // une entrée d'historique, et "précédent" referme la modale plutôt que
  // de quitter l'app.
  useEffect(() => {
    if (!profileOpen) return

    history.pushState({ profile: true }, '')

    const handlePop = () => setProfileOpen(false)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [profileOpen])

  // Même logique de retour Android pour le calendrier.
  useEffect(() => {
    if (!calendarOpen) return

    history.pushState({ calendar: true }, '')

    const handlePop = () => setCalendarOpen(false)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [calendarOpen])

  // Le calendrier s'ouvre en page-modal PAR-DESSUS l'onglet actif sans le
  // démonter (contrairement à un changement d'onglet) — donc TodayPage garde
  // son ancien useJournal en mémoire même après un ajout/suppression/
  // "marquer mangé" fait depuis le calendrier. On force un remontage propre
  // (nouvelles données) à la fermeture, via un compteur utilisé comme key.
  const [journalVersion, setJournalVersion] = useState(0)
  useEffect(() => {
    if (!calendarOpen) setJournalVersion(v => v + 1)
  }, [calendarOpen])

  const pages = {
    today:    <TodayPage key={journalVersion} />,
    manual:   <ManualPage />,
    courses:  <ShoppingListPage />,
    history:  <HistoryPage key={journalVersion} />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProfileButton onClick={() => setProfileOpen(true)} onCalendarClick={() => setCalendarOpen(true)} hidden={headerHidden} />

      {/* overflow visible ici — c'est page-content qui scroll en interne */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }} onScrollCapture={handleScroll}>
        {pages[tab]}
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon active={active} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {profileOpen && (
        <div className="page-modal">
          <div className="page-modal-header">
            <h2>Profil</h2>
            <button className="btn-icon" onClick={() => history.back()} aria-label="Fermer">
              <CloseIcon />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
            <ProfilePage />
          </div>
        </div>
      )}

      {calendarOpen && (
        <div className="page-modal">
          <div className="page-modal-header">
            <h2>Calendrier</h2>
            <button className="btn-icon" onClick={() => history.back()} aria-label="Fermer">
              <CloseIcon />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
            <CalendarPage />
          </div>
        </div>
      )}
    </div>
  )
}

function Gate() {
  const { session, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="loader"><div className="spinner" /> Chargement...</div>
      </div>
    )
  }

  return session ? <AppShell /> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  )
}