import React, { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { useFodmapProfile, useRecipeFodmap, recipeFodmapItems } from '../hooks/useFodmapProfile'
import {
  FODMAP_GROUPS, evaluateFodmap, evaluateMeal, safePortion, mealSafePortion,
  fodmapSubstitution, roundPortion, formatGrams,
} from '../lib/fodmap'
import FodmapPill, { FODMAP_LEVEL_STYLE, FODMAP_NOTABLE } from './FodmapPill'

// ─────────────────────────────────────────────────────────────────────────────
// FodmapPanel — charge en FODMAP d'un aliment ou d'une recette à la quantité
// saisie (chantier FODMAP, Paliers 1 et 3 — voir docs/fodmap.md). Affiché
// seulement si l'utilisatrice l'a activé dans Profil > FODMAP
// (settings.fodmap.enabled).
//
// `food`              : objet aliment /100 g (même format que FoodPicker /
//                       explorateur). Recette = `_source: 'recette'` + `id`.
// `qty`               : quantité en grammes (nombre ou chaîne saisie).
// `ingredientsDetail` : optionnel, journal.ingredients_detail d'une recette
//                       ajoutée au journal (grammages corrigés à l'ajout).
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_STYLE = FODMAP_LEVEL_STYLE
const OVERALL_LABEL = { unknown: 'Données incomplètes' }

const CONFIDENCE_LABEL = {
  measured: 'mesuré',
  ciqual: 'mesuré (Ciqual)',
  label: 'étiquette',
  derived: 'déduit d’une portion publiée',
  estimated: 'estimé',
  absent: 'absent de ce type d’aliment',
  user: 'indiqué dans ta fiche',
}

const GROUP_LABEL_LOWER = Object.fromEntries(FODMAP_GROUPS.map(g => [g.key, g.label.toLowerCase()]))

function portionText(sp, what = 'cet aliment') {
  if (!sp) return null
  if (sp.grams === Infinity) {
    return sp.partial
      ? 'Pas de limite connue, mais certaines données manquent.'
      : `Pas de FODMAP dans ${what}.`
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

function formatLoad(x) {
  if (x === 0) return '0'
  if (x < 0.1) return '< 0,1× le seuil'
  return `${(Math.round(x * 10) / 10).toString().replace('.', ',')}× le seuil`
}

// Ligne d'une famille : pastille de couleur, libellé, valeur, détail.
function GroupRow({ level, label, value, detail, aside }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.unknown
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: '0.5px solid var(--border)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: s.color, whiteSpace: 'nowrap' }}>{value}</span>
        </div>
        {(detail || aside) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-hint)', flex: 1, lineHeight: 1.4 }}>{detail}</span>
            {aside && <span style={{ fontSize: 11, color: 'var(--text-hint)', whiteSpace: 'nowrap' }}>{aside}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// Cadre commun : en-tête repliable avec le niveau global, ligne « portion
// sûre » toujours visible, détail et explication une fois déplié.
function PanelShell({ subtitle, overall, portionLine, about, children }) {
  const [open, setOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', textAlign: 'left' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>FODMAP</span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</span>
        </span>
        <FodmapPill level={overall} text={OVERALL_LABEL[overall]} />
        <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {portionLine && (
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {portionLine}
        </div>
      )}

      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          {children}
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
              jusqu’à deux fois le seuil « modéré », au-delà « élevé ». {about} Les teneurs varient (maturité,
              cuisson…) et ne remplacent pas l’avis d’un médecin ou d’un·e diététicien·ne.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FoodFodmap({ food, qty }) {
  const { profile } = useFodmapProfile(food, true)
  if (!profile) return null

  const qtyG = parseFloat(qty) || 0
  const ev = evaluateFodmap(profile, qtyG)

  return (
    <PanelShell
      subtitle={`pour ${Math.round(qtyG)} g`}
      overall={ev.overall}
      portionLine={portionText(safePortion(profile))}
      about="Plusieurs aliments d’un même repas s’additionnent."
    >
      {ev.rows.map(r => (
        <GroupRow
          key={r.key}
          level={r.level}
          label={r.label}
          value={r.amount != null ? formatGrams(r.amount) : '—'}
          detail={rowDetail(r)}
          aside={`seuil ${formatGrams(r.threshold)}`}
        />
      ))}
      {profile.note && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--gray-bg)', borderRadius: 8, padding: '9px 11px', marginTop: 6 }}>
          {profile.note}
        </div>
      )}
    </PanelShell>
  )
}

function contributorsText(contributors) {
  const top = contributors.slice(0, 3).map(c => (c.share == null ? `${c.name} (quantité inconnue)` : c.name))
  const more = contributors.length - top.length
  return top.join(', ') + (more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : '')
}

function RecipeFodmap({ food, qty, ingredientsDetail }) {
  const { data } = useRecipeFodmap(food.id, true)
  const qtyG = parseFloat(qty) || 0

  const ev = useMemo(
    () => (data ? evaluateMeal(recipeFodmapItems(data, qtyG, ingredientsDetail)) : null),
    [data, qtyG, ingredientsDetail],
  )
  const sp = useMemo(
    () => (data ? mealSafePortion(evaluateMeal(recipeFodmapItems(data, 100, ingredientsDetail))) : null),
    [data, ingredientsDetail],
  )
  if (!ev?.overall) return null

  // Alternatives pour les ingrédients qui pèsent dans une famille modérée ou
  // élevée (un ingrédient cité une seule fois, même s'il pèse dans deux).
  const substitutions = []
  const seen = new Set()
  for (const r of ev.rows) {
    if (!FODMAP_NOTABLE.has(r.level)) continue
    for (const c of r.contributors.slice(0, 3)) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      const text = fodmapSubstitution(c.name)
      if (text) substitutions.push({ name: c.name, text })
    }
  }

  return (
    <PanelShell
      subtitle={`pour ${Math.round(qtyG)} g de recette`}
      overall={ev.overall}
      portionLine={portionText(sp, 'cette recette')}
      about="Pour une recette, chaque ingrédient compte pour sa part de la portion, et les ingrédients s’additionnent comme les aliments d’un repas."
    >
      {ev.rows.map(r => (
        <GroupRow
          key={r.key}
          level={r.level}
          label={r.label}
          value={r.level === 'unknown' ? '—' : r.level === 'likely-high' && r.load <= 1 ? 'probable' : formatLoad(r.load)}
          detail={r.contributors.length
            ? `${r.contributors.length > 1 ? 'Surtout : ' : ''}${contributorsText(r.contributors)}${r.complete ? '' : ' · données incomplètes'}`
            : r.level === 'unknown' ? 'Pas de donnée pour ces ingrédients' : r.complete ? null : 'données incomplètes'}
        />
      ))}
      {ev.skipped > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>
          {ev.skipped === 1 ? '1 ingrédient n’a pas pu être compté' : `${ev.skipped} ingrédients n’ont pas pu être comptés`} faute de données.
        </div>
      )}
      {substitutions.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, background: 'var(--gray-bg)', borderRadius: 8, padding: '9px 11px', marginTop: 8 }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Souvent utilisé à la place</div>
          {substitutions.map(s => (
            <div key={s.name}>
              <span style={{ fontWeight: 600 }}>{s.name}</span> → {s.text}
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}

export default function FodmapPanel({ food, qty, ingredientsDetail = null }) {
  const { settings } = useSettings()
  if (!settings.fodmap?.enabled || !food) return null
  if (food._source === 'recette') {
    return food.id ? <RecipeFodmap food={food} qty={qty} ingredientsDetail={ingredientsDetail} /> : null
  }
  return <FoodFodmap food={food} qty={qty} />
}
