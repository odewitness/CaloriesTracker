import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ToastProvider } from './lib/toast'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useProfile } from './hooks/useProfile'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TodayPage from './pages/TodayPage'
import ManualPage from './pages/ManualPage'
import ShoppingListPage from './pages/ShoppingListPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import CalendarPage from './pages/CalendarPage'
import WhatsNewPage from './pages/WhatsNewPage'
import MeasurementsPage from './pages/MeasurementsPage'
import SocialPage from './pages/SocialPage'
import Loader from './components/Loader'
import { getLatestChangelogKey } from './lib/changelog'
import { useFriends } from './hooks/useFriends'
import { useSocialNotifications } from './hooks/useSocialNotifications'

const WHATSNEW_SEEN_KEY = 'whatsnew_last_seen'

const TABS = [
  { path: '/today',    label: "Aujourd'hui", icon: HomeIcon },
  { path: '/manual',   label: 'Mes aliments', icon: PencilIcon },
  { path: '/courses',  label: 'Courses',     icon: CartIcon },
  { path: '/history',  label: 'Historique',  icon: ChartIcon },
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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  )
}

function SocialButtonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

// Bouton rond en haut à droite : ouvre ProfilePage en plein écran par-dessus
// l'app, sans occuper d'onglet dans la bottom nav.
// hidden=true → le bandeau se rétracte (scroll vers le bas), voir handleScroll.
function ProfileButton({ onClick, onCalendarClick, onWhatsNewClick, onSocialClick, hasUnreadNews, hasFriendRequests, hidden }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const initials = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase()
    || (user?.email?.[0] || '').toUpperCase()

  return (
    <div className={`top-bar${hidden ? ' top-bar-hidden' : ''}`}>
      <button className="profile-avatar-btn" onClick={onCalendarClick} aria-label="Calendrier">
        <CalendarButtonIcon />
      </button>
      <button className="profile-avatar-btn" onClick={onSocialClick} aria-label="Amies" style={{ position: 'relative' }}>
        <SocialButtonIcon />
        {hasFriendRequests && <span className="notif-dot" />}
      </button>
      <button className="profile-avatar-btn" onClick={onWhatsNewClick} aria-label="Nouveautés" style={{ position: 'relative' }}>
        <BellIcon />
        {hasUnreadNews && <span className="notif-dot" />}
      </button>
      <button className="profile-avatar-btn" onClick={onClick} aria-label="Profil">
        {initials ? initials : <ProfileIcon />}
      </button>
    </div>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { incomingRequests } = useFriends()
  const { hasUnseen: hasSocialActivity, items: socialItems, loading: socialLoading, markSeen: markSocialSeen } = useSocialNotifications()

  // Le profil et le calendrier s'ouvrent comme des routes "par-dessus" la
  // route de fond (pattern React Router du modal avec sa propre URL) : on
  // mémorise dans le state de navigation la route affichée EN DESSOUS, pour
  // continuer à la rendre pendant que la modale est ouverte. Si l'utilisateur
  // arrive directement sur /profil ou /calendrier (lien, rechargement), il
  // n'y a pas de backgroundLocation → on retombe sur l'onglet par défaut,
  // comme au chargement initial de l'app aujourd'hui.
  const backgroundLocation = location.state?.backgroundLocation
  const activePath = (backgroundLocation || location).pathname

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
  }, [activePath])

  const handleScroll = (e) => {
    const top = e.target.scrollTop
    const delta = top - lastScrollTop.current
    if (top <= 4) setHeaderHidden(false)        // tout en haut → toujours visible
    else if (delta > 6) setHeaderHidden(true)    // scroll vers le bas → se cache
    else if (delta < -6) setHeaderHidden(false)  // scroll vers le haut → réapparaît
    lastScrollTop.current = top
  }

  const goToTab = (path) => { if (activePath !== path) navigate(path) }
  const openOverlay = (path) => navigate(path, { state: { backgroundLocation: backgroundLocation || location } })
  const closeOverlay = () => navigate(-1)

  // Petit point rouge sur la cloche tant que la dernière entrée du
  // changelog n'a pas été vue (comparaison de dates via localStorage).
  const [hasUnreadNews, setHasUnreadNews] = useState(() => {
    try { return localStorage.getItem(WHATSNEW_SEEN_KEY) !== getLatestChangelogKey() } catch { return false }
  })
  const openWhatsNew = () => {
    openOverlay('/whatsnew')
    try { localStorage.setItem(WHATSNEW_SEEN_KEY, getLatestChangelogKey()) } catch { /* ignore */ }
    setHasUnreadNews(false)
  }

  // L'activité sociale (réactions/commentaires/réponses reçus) n'est marquée
  // vue que lorsque l'utilisatrice ouvre spécifiquement l'onglet "Activité"
  // (voir markSeen passé à SocialPage) — pas juste à l'ouverture de la page,
  // pour que la pastille reste visible tant qu'elle n'a pas vraiment consulté
  // le détail. Les demandes d'amies, elles, restent indiquées tant qu'elles
  // n'ont pas été traitées (pas une histoire de "vu").
  const openSocial = () => {
    openOverlay('/social')
  }

  // Le calendrier s'ouvre PAR-DESSUS l'onglet actif sans le démonter (sa
  // route de fond reste rendue) — donc TodayPage garde son ancien useJournal
  // en mémoire même après un ajout/suppression/"marquer mangé" fait depuis
  // le calendrier. On force un remontage propre (nouvelles données) à la
  // fermeture, via un compteur utilisé comme key.
  const [journalVersion, setJournalVersion] = useState(0)
  const wasOnCalendar = useRef(false)
  useEffect(() => {
    const onCalendar = location.pathname === '/calendar'
    if (wasOnCalendar.current && !onCalendar) setJournalVersion(v => v + 1)
    wasOnCalendar.current = onCalendar
  }, [location.pathname])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProfileButton
        onClick={() => openOverlay('/profile')}
        onCalendarClick={() => openOverlay('/calendar')}
        onWhatsNewClick={openWhatsNew}
        onSocialClick={openSocial}
        hasUnreadNews={hasUnreadNews}
        hasFriendRequests={incomingRequests.length > 0 || hasSocialActivity}
        hidden={headerHidden}
      />

      {/* overflow visible ici — c'est page-content qui scroll en interne */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }} onScrollCapture={handleScroll}>
        <Routes location={backgroundLocation || location}>
          <Route path="/today" element={<TodayPage key={journalVersion} />} />
          <Route path="/manual" element={<ManualPage />} />
          <Route path="/courses" element={<ShoppingListPage />} />
          <Route path="/history" element={<HistoryPage key={journalVersion} />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>

      <nav className="bottom-nav">
        {TABS.map(t => {
          const Icon = t.icon
          const active = activePath === t.path
          return (
            <button key={t.path} className={`nav-item ${active ? 'active' : ''}`} onClick={() => goToTab(t.path)}>
              <Icon active={active} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {backgroundLocation && (
        <Routes>
          <Route path="/profile" element={
            <div className="page-modal">
              <div className="page-modal-header">
                <h2>Profil</h2>
                <button className="btn-icon" onClick={closeOverlay} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
                <ProfilePage />
              </div>
            </div>
          } />
          <Route path="/calendar" element={
            <div className="page-modal">
              <div className="page-modal-header">
                <h2>Calendrier</h2>
                <button className="btn-icon" onClick={closeOverlay} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
                <CalendarPage />
              </div>
            </div>
          } />
          <Route path="/whatsnew" element={
            <div className="page-modal">
              <div className="page-modal-header">
                <h2>Nouveautés</h2>
                <button className="btn-icon" onClick={closeOverlay} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
                <WhatsNewPage />
              </div>
            </div>
          } />
          <Route path="/mensurations" element={
            <div className="page-modal">
              <div className="page-modal-header">
                <h2>Poids & mensurations</h2>
                <button className="btn-icon" onClick={closeOverlay} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
                <MeasurementsPage />
              </div>
            </div>
          } />
          <Route path="/social" element={
            <div className="page-modal">
              <div className="page-modal-header">
                <h2>Amies</h2>
                <button className="btn-icon" onClick={closeOverlay} aria-label="Fermer">
                  <CloseIcon />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}>
                <SocialPage
                  hasUnseenActivity={hasSocialActivity}
                  activityItems={socialItems}
                  activityLoading={socialLoading}
                  markActivitySeen={markSocialSeen}
                />
              </div>
            </div>
          } />
        </Routes>
      )}
    </div>
  )
}

function Gate() {
  const { session, authLoading } = useAuth()

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader />
      </div>
    )
  }

  return session ? <AppShell /> : <AuthPage />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}