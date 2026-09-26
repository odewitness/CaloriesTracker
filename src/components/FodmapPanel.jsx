import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { useFodmapProfile } from '../hooks/useFodmapProfile'
import {
  FODMAP_GROUPS, evaluateFodmap, safePortion, roundPortion, formatGrams,
} from '../lib/fodmap'

// ─────────────────────────────────────────────────────────────────────────────
// FodmapPanel — charge en FODMAP d'un aliment à la quantité saisie (chantier
// FODMAP, Palier 1 — voir docs/fodmap.md). Affiché seulement si l'utilisatrice
// l'a activé dans Profil > FODMAP (settings.fodmap.enabled).
//
// `food` : objet aliment /100 g (même format que FoodPicker / explorateur).
// `qty`  : quantité en grammes (nombre ou chaîne saisie).
// Pas de rendu pour les recettes et les compléments : le calcul par
// ingrédient d'une recette arrive au Palier 3.
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_STYLE = {
  low: { label: 'Faible', dot: 'var(--green)', bg: 'var(--green-light)', color: 'var(--green-dark)' },
  'likely-low': { label: 'Probablement faible', dot: 'var(--green)', bg: 'var(--gray-bg)', color: 'var(--text-muted)' },
  unknown: { label: 'Inconnu', dot: 'var(--text-hint)', bg: 'var(--gray-bg)', color: 'var(--text-muted)' },
  'likely-high': { label: 'Probablement élevé', dot: 'var(--amber)', bg: 'var(--amber-light)', color: 'var(--amber)' },
  moderate: { label: 'Modéré', dot: 'var(--amber)', bg: 'var(--amber-light)', color: 'var(--amber)' },
  high: { label: 'Élevé', dot: 'var(--coral)', bg: 'var(--coral-light)', color: 'var(--coral)' },
}
const OVERALL_LABEL = { unknown: 'Données incomplètes' }

const CONFIDENCE_LABEL = {
  measured: 'mesuré',
  ciqual: 'mesuré (Ciqual)',
  label: 'étiquette',
  derived: 'déduit d’une portion publiée',
  estimated: 'estimé',
  absent: 'absent de ce type d’aliment',
}

const GROUP_LABEL_LOWER = Object.fromEntries(FODMAP_GROUPS.map(g => [g.key, g.label.toLowerCase()]))

function Pill({ level, text }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.unknown
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
      background: s.bg, color: s.color, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {text || s.label}
    </span>
  )
}

function portionText(sp) {
  if (!sp) return null
  if (sp.grams === Infinity) {
    return sp.partial
      ? 'Pas de limite connue, mais certaines données manquent.'
      : 'Pas de FODMAP dans cet aliment.'
  }
  const g = roundPortion(sp.grams)
  const group = GROUP_LABEL_LOWER[sp.groupKey]
  if (g < 5) return `Même une petite quantité dépasse le seuil (${group}).`
  return `Faible jusqu’à environ ${g} g · au-delà : ${group}${sp.partial ? ' (d’après les données connues)' : ''}.`
}

function rowDetail(r) {
  if (r.amount == null) {
    if (r.keyword) return `Probablement présent (${r.keyword.join(', ')}), quantité non mesurée`
    return 'Pas de donnée pour cet aliment'
  }
  const bits = []
  if (r.parts.length > 1 || (r.parts.length === 1 && !r.complete)) {
    bits.push(r.parts.map(p => `${p.label} ${formatGrams(p.amount)}`).join(' + '))
  }
  if (!r.complete) bits.push('données incomplètes')
  if (r.confidence && r.confidence !== 'absent') bits.push(CONFIDENCE_LABEL[r.confidence] || r.confidence)
  return bits.join(' · ')
}

export default function FodmapPanel({ food, qty }) {
  const { settings } = useSettings()
  const enabled = !!settings.fodmap?.enabled
  const hidden = !food || food._source === 'recette'
  const { profile } = useFodmapProfile(hidden ? null : food, enabled && !hidden)
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  if (!enabled || hidden || !profile) return null

  const qtyG = parseFloat(qty) || 0
  const ev = evaluateFodmap(profile, qtyG)
  const sp = safePortion(profile)

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', textAlign: 'left' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>FODMAP</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            pour {Math.round(qtyG)} g
          </span>
        </span>
        <Pill level={ev.overall} text={OVERALL_LABEL[ev.overall]} />
        <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {portionText(sp)}
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          {ev.rows.map(r => {
            const s = LEVEL_STYLE[r.level] || LEVEL_STYLE.unknown
            return (
              <div key={r.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: '0.5px solid var(--border)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: s.color, whiteSpace: 'nowrap' }}>
                      {r.amount != null ? formatGrams(r.amount) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-hint)', flex: 1, lineHeight: 1.4 }}>{rowDetail(r)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-hint)', whiteSpace: 'nowrap' }}>
                      seuil {formatGrams(r.threshold)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {profile.note && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--gray-bg)', borderRadius: 8, padding: '9px 11px', marginTop: 6 }}>
              {profile.note}
            </div>
          )}

          <button
            onClick={() => setAboutOpen(o => !o)}
            style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font)' }}
          >
            {aboutOpen ? 'Masquer l’explication' : 'Comment lire ces chiffres ?'}
          </button>
          {aboutOpen && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 6 }}>
              Les FODMAP sont des sucres que l’intestin absorbe mal. Ils ne sont pas mauvais pour la santé,
              mais peuvent donner ballonnements ou inconfort quand l’intestin est sensible. Chaque famille est
              comparée à un seuil par portion utilisé par les diététiciens : en dessous, c’est « faible »,
              jusqu’à deux fois le seuil « modéré », au-delà « élevé ». Plusieurs aliments d’un même repas
              s’additionnent. Les teneurs varient (maturité, cuisson…) et ne remplacent pas l’avis d’un
              médecin ou d’un·e diététicien·ne.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
