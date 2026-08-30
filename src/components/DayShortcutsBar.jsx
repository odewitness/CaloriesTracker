import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { EyeOff, Eye, Scale, CalendarPlus, Share2, HeartPulse } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// DayShortcutsBar — rangée d'actions rapides rattachées au jour affiché,
// dépliée depuis le bouton "trois points" de l'en-tête (voir ProfileButton /
// useTodayShortcuts). Repliée par défaut : zéro encombrement sur la page.
// Rendue dans DaySlot (TodayPage.jsx), là où vivent les données du jour.
//   • Exclure / réinclure ce jour des stats (toggle useExcludedDay, aucun
//     journal touché)
//   • Ouvrir "Poids & mensurations" pour saisir un relevé
//   • Planifier un repas sur ce jour (PlanMealModal, rendu en portal côté DaySlot)
//   • Ouvrir Profil › Cycle & alimentation (state.section, lu par ProfilePage)
//   • Partager la journée avec ses amies (masqué si aucun aliment saisi)
// Ce ne sont que des <button> : pas de position:fixed ici, la rangée peut
// vivre dans le slider de swipe sans souci.
// ─────────────────────────────────────────────────────────────────────────────
export default function DayShortcutsBar({ excluded, onToggleExcluded, onPlanMeal, onShare, canShare }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Même pattern d'overlay que le calendrier / le profil (voir AppShell).
  const openMeasurements = () => {
    navigate('/mensurations', { state: { backgroundLocation: location } })
  }
  const openCycle = () => {
    navigate('/profile', { state: { backgroundLocation: location, section: 'cycle' } })
  }

  const items = [
    {
      key: 'exclude',
      icon: excluded ? Eye : EyeOff,
      label: excluded ? 'Réinclure' : 'Exclure',
      onClick: onToggleExcluded,
      active: excluded,
    },
    { key: 'weight', icon: Scale, label: 'Relevé', onClick: openMeasurements },
    { key: 'plan', icon: CalendarPlus, label: 'Planifier', onClick: onPlanMeal },
    { key: 'cycle', icon: HeartPulse, label: 'Cycle', onClick: openCycle },
    ...(canShare ? [{ key: 'share', icon: Share2, label: 'Partager', onClick: onShare }] : []),
  ]

  return (
    <div className="day-shortcuts-bar" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
      {items.map(({ key, icon: Icon, label, onClick, active }) => (
        <button
          key={key}
          onClick={onClick}
          aria-label={label}
          title={label}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32,
            padding: 0, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: active ? 'var(--green-light)' : 'var(--gray-bg)',
            color: active ? 'var(--green-dark)' : 'var(--text-muted)',
          }}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}
