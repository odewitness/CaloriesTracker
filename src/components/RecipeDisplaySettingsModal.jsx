import React from 'react'
import { X, LayoutGrid, List, Image as ImageIcon, RectangleHorizontal } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { Row, ToggleSwitch } from './profile/primitives'
import { DEFAULT_RECIPE_DISPLAY_PREFS, isDefaultRecipeDisplayPrefs } from '../lib/recipeDisplayPrefs'

const INFO_TOGGLES = [
  { key: 'showType',    label: 'Type de recette' },
  { key: 'showSeasons', label: 'Saisons' },
  { key: 'showTime',    label: 'Temps de préparation' },
  { key: 'showBadge',   label: 'Badge « riche en… »' },
]

const sectionLabel = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 9px',
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            background: value === o.key ? 'var(--white)' : 'transparent',
            color:      value === o.key ? 'var(--text)'  : 'var(--text-muted)',
            boxShadow:  value === o.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all .15s',
          }}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDisplaySettingsModal — feuille « Affichage des recettes » : choisit
// quelles infos apparaissent sur les cartes de la liste, le format de l'image
// (miniature / couverture) et la disposition (liste / grille). Application
// immédiate : chaque changement remonte via onChange, RecipesSection persiste
// en localStorage.
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDisplaySettingsModal({ value, onChange, onClose }) {
  useBackButton(onClose)
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ display: 'flex', flexDirection: 'column', padding: 0, maxHeight: '86dvh' }}>

        <div style={{ flexShrink: 0, padding: '14px 20px 0' }}>
          <div className="modal-handle" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>Affichage des recettes</span>
            <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)' }} aria-label="Fermer">
              <X size={19} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 14px' }}>
          <div style={sectionLabel}>Informations affichées</div>
          <div className="card" style={{ padding: 0, marginBottom: 22, overflow: 'hidden' }}>
            {INFO_TOGGLES.map(t => (
              <Row key={t.key} label={t.label}>
                <ToggleSwitch checked={value[t.key]} onClick={() => set({ [t.key]: !value[t.key] })} />
              </Row>
            ))}
          </div>

          <div style={sectionLabel}>Image</div>
          <div style={{ marginBottom: 22 }}>
            <Segmented
              value={value.imageMode}
              onChange={(v) => set({ imageMode: v })}
              options={[
                { key: 'thumb', label: 'Miniature',  icon: <ImageIcon size={14} /> },
                { key: 'cover', label: 'Couverture', icon: <RectangleHorizontal size={14} /> },
              ]}
            />
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 7 }}>
              « Couverture » place la photo en bandeau pleine largeur en haut de la carte.
            </div>
          </div>

          <div style={sectionLabel}>Disposition</div>
          <Segmented
            value={value.layout}
            onChange={(v) => set({ layout: v })}
            options={[
              { key: 'list', label: 'Liste',  icon: <List size={14} /> },
              { key: 'grid', label: 'Grille', icon: <LayoutGrid size={14} /> },
            ]}
          />
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 7 }}>
            En grille, les cartes sont resserrées : photo, nom et calories seulement.
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '12px 20px calc(18px + env(safe-area-inset-bottom))', borderTop: '.5px solid var(--border)' }}>
          <button className="btn-primary" onClick={onClose}>OK</button>
          {!isDefaultRecipeDisplayPrefs(value) && (
            <button
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'center', marginTop: 8 }}
              onClick={() => onChange({ ...DEFAULT_RECIPE_DISPLAY_PREFS })}
            >
              Réinitialiser l'affichage
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
