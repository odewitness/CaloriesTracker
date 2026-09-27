import React from 'react'
import { ChefHat } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CookModeButton — bouton « mode cuisine » d'un header de page-modal (toque
// verte quand actif). Reçoit l'objet retourné par useWakeLock() ; ne rend
// rien si le navigateur ne supporte pas le Wake Lock.
// Props : cookMode ({ active, supported, toggle })
// ─────────────────────────────────────────────────────────────────────────────
export default function CookModeButton({ cookMode }) {
  if (!cookMode?.supported) return null
  const { active, toggle } = cookMode
  return (
    <button
      className="btn-icon"
      onClick={toggle}
      style={{
        flexShrink: 0,
        color: active ? 'var(--green-dark)' : 'var(--text-hint)',
        background: active ? 'var(--green-light)' : undefined,
        borderRadius: 10,
      }}
      aria-label={active ? 'Désactiver le mode cuisine' : 'Activer le mode cuisine'}
      title={active ? 'Mode cuisine actif — l\'écran reste allumé' : 'Mode cuisine — garder l\'écran allumé'}
    >
      <ChefHat size={18} />
    </button>
  )
}
