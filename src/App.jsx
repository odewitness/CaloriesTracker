import React, { useState, useEffect } from 'react'
import { ToastProvider } from './lib/toast'
import { AuthProvider, useAuth } from './lib/AuthContext'
import AuthPage from './pages/AuthPage'
import TodayPage from './pages/TodayPage'
import MealsPage from './pages/MealsPage'
import ManualPage from './pages/ManualPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'

const TABS = [
  { id: 'today',   label: "Aujourd'hui", icon: HomeIcon },
  { id: 'meals',   label: 'Repas types', icon: UtensilsIcon },
  { id: 'manual',  label: 'Mes aliments', icon: PencilIcon },
  { id: 'history', label: 'Historique',  icon: ChartIcon },
  { id: 'profile', label: 'Profil',      icon: ProfileIcon },
]

function HomeIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function UtensilsIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
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

function ChartIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function AppShell() {
  const [tab, setTab] = useState('today')

  // Retour Android : pousse une entrée à chaque changement d'onglet,
  // et écoute popstate pour revenir à 'today' — sans jamais appeler history.back() au cleanup.
  useEffect(() => {
    if (tab === 'today') return

    history.pushState({ tab }, '')

    const handlePop = () => setTab('today')
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [tab])

  const pages = {
    today:    <TodayPage />,
    meals:    <MealsPage />,
    manual:   <ManualPage />,
    history:  <HistoryPage />,
    profile:  <ProfilePage />,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* overflow visible ici — c'est page-content qui scroll en interne */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
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