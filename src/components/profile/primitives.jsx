import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useBackButton } from '../../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// Briques partagées entre le hub du profil et ses écrans de détail.
// Extraites de l'ancien ProfilePage monolithique.
// ─────────────────────────────────────────────────────────────────────────────

// Ligne d'un formulaire dans une carte (label à gauche, contrôle à droite).
export function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      {icon && <div style={{ color: 'var(--green)', flexShrink: 0 }}>{icon}</div>}
      <div style={{ flex: 1, fontSize: 14 }}>{label}</div>
      {children}
    </div>
  )
}

export function ToggleSwitch({ checked, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
        background: checked ? 'var(--green)' : 'var(--border-md)',
        transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

export function Stepper({ value, display, onDec, onInc, min, max, wide }) {
  const btn = { width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={onDec} disabled={min != null && value <= min} style={{ ...btn, opacity: min != null && value <= min ? 0.4 : 1 }} aria-label="Moins"><Minus size={15} /></button>
      <div style={{ minWidth: wide ? 84 : 56, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--blue)' }}>{display}</div>
      <button onClick={onInc} disabled={max != null && value >= max} style={{ ...btn, opacity: max != null && value >= max ? 0.4 : 1 }} aria-label="Plus"><Plus size={15} /></button>
    </div>
  )
}

// Champ objectif quotidien (Calories, Protéines…).
// Buffer texte local : évite qu'effacer le champ pour taper une nouvelle
// valeur ne le fasse passer furtivement par 0 (voir CLAUDE.md / historique).
export function GoalField({ icon, label, value, unit, color, onChange }) {
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])

  const handleChange = (e) => {
    const v = e.target.value
    setText(v)
    if (v === '') return // en cours d'effacement, ne pas forcer 0 tant que rien n'est retapé
    const num = parseInt(v, 10)
    if (!isNaN(num)) onChange(num)
  }

  const handleBlur = () => {
    if (text === '' || isNaN(parseInt(text, 10))) setText(String(value))
  }

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
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          style={{ width: 72, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', color, background: 'var(--gray-bg)', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{unit}</span>
      </div>
    </div>
  )
}

// Ligne de navigation du hub : icône · label · résumé de la valeur · chevron.
export function NavRow({ icon, label, value, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: '0.5px solid var(--border)',
        fontFamily: 'var(--font)', textAlign: 'left', background: 'none',
      }}
    >
      <div style={{ color: danger ? 'var(--coral)' : 'var(--green)', flexShrink: 0, display: 'flex' }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: danger ? 'var(--coral)' : 'var(--text)' }}>{label}</div>
      {value != null && (
        <div style={{ fontSize: 12.5, color: 'var(--text-hint)', flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      )}
      {!danger && <ChevronRight size={16} color="var(--text-hint)" style={{ flexShrink: 0 }} />}
    </button>
  )
}

// En-tête d'un écran de détail : flèche retour + titre, puis contenu.
// Rendu dans le .page-content standard (scroll interne géré par le parent).
// useBackButton : le « retour » Android/navigateur revient au hub (onBack)
// au lieu de fermer tout l'overlay Profil — même pattern que les modales.
export function SectionScreen({ title, onBack, children }) {
  useBackButton(onBack)
  return (
    <div className="page-content">
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', marginBottom: 18, marginLeft: -4, padding: '4px 0' }}
      >
        <ChevronLeft size={20} /> {title}
      </button>
      {children}
    </div>
  )
}

// Bouton "Enregistrer" collant en bas d'un écran de formulaire, visible
// seulement quand il y a des changements non sauvegardés.
export function SaveBar({ visible, onSave, saving, label = 'Enregistrer' }) {
  if (!visible) return null
  return (
    <button
      className="btn-primary"
      onClick={onSave}
      disabled={saving}
      style={{ marginTop: 4, marginBottom: 20, opacity: saving ? 0.7 : 1 }}
    >
      {saving ? 'Sauvegarde…' : `💾 ${label}`}
    </button>
  )
}
