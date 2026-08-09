import React, { useState, useEffect } from 'react'
import { ToastProvider } from './lib/toast'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useProfile } from './hooks/useProfile'
import AuthPage from './pages/AuthPage'
import TodayPage from './pages/TodayPage'
import ManualPage from './pages/ManualPage'
import ShoppingListPage from './pages/ShoppingListPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'

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

// Bouton rond en haut à droite : ouvre ProfilePage en plein écran par-dessus
// l'app, sans occuper d'onglet dans la bottom nav.
function ProfileButton({ onClick }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const initials = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()
    || (user?.email?.[0] || '').toUpperCase()

  return (
    <div className="top-bar">
      <button className="profile-avatar-btn" onClick={onClick} aria-label="Profil">
        {initials ? initials : <ProfileIcon />}
      </button>
    </div>
  )
}

function AppShell() {
  const [tab, setTab] = useState('today')
  const [profileOpen, setProfileOpen] = useState(false)

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

  const pages = {
    today:    <TodayPage />,
    manual:   <ManualPage />,
    courses:  <ShoppingListPage />,
    history:  <HistoryPage />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-stack">
        <div className="page-scroll">
          {pages[tab]}
        </div>
        <ProfileButton onClick={() => setProfileOpen(true)} />
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