import React, { useState } from 'react'
import { ChevronDown, Wheat } from 'lucide-react'
import FodmapPill, { FODMAP_NOTABLE } from './FodmapPill'
import { LEVEL_RANK } from '../lib/fodmap'

// ─────────────────────────────────────────────────────────────────────────────
// FodmapDayCard — carte « FODMAP » de la page du jour (chantier FODMAP,
// Palier 2 — voir docs/fodmap.md). Résume, repas par repas, la charge cumulée
// en FODMAP et les aliments qui y contribuent le plus. Information seulement.
// Rendue par TodayPage uniquement si settings.fodmap.enabled.
//
// Props :
//   meals     — { [repas]: evaluateMeal(...) } (useDayFodmap), null en chargement.
//               Les recettes y comptent pour leurs ingrédients.
//   mealOrder — ordre d'affichage des repas
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_LABEL = {
  low: 'Faible', 'likely-low': 'Probablement faible', unknown: 'Incomplet',
  'likely-high': 'Probablement élevé', moderate: 'Modéré', high: 'Élevé',
}

function formatLoad(x) {
  return `${(Math.round(x * 10) / 10).toString().replace('.', ',')}× le seuil`
}

function contributorsText(contributors) {
  const top = contributors.slice(0, 3).map(c => c.name)
  const more = contributors.length - top.length
  return top.join(', ') + (more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : '')
}

function MealBlock({ meal, ev }) {
  const notable = ev.rows.filter(r => FODMAP_NOTABLE.has(r.level))
  return (
    <div style={{ padding: '10px 0', borderTop: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{meal}</span>
        <FodmapPill small level={ev.overall} text={MEAL_LABEL[ev.overall]} />
      </div>
      {notable.map(r => (
        <div key={r.key} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.label}</span>
          {r.level === 'likely-high' ? ' · probablement présent' : ` · ${formatLoad(r.load)}`}
          {r.contributors.length > 0 && <> — {contributorsText(r.contributors)}</>}
          {r.stacked && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
              Aucun aliment ne dépasse le seuil seul : c’est le cumul du repas.
            </div>
          )}
        </div>
      ))}
      {ev.skipped > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>
          {ev.skipped === 1 ? '1 élément n’a pas pu être compté' : `${ev.skipped} éléments n’ont pas pu être comptés`} faute de données.
        </div>
      )}
    </div>
  )
}

export default function FodmapDayCard({ meals, mealOrder }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fodmap-day-collapsed')) ?? false }
    catch { return false }
  })
  const [aboutOpen, setAboutOpen] = useState(false)
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('fodmap-day-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  const loading = meals == null
  const list = loading ? [] : mealOrder.filter(m => meals[m]).map(m => ({ meal: m, ev: meals[m] }))
  const rated = list.filter(x => x.ev.overall)
  const worst = rated.reduce((w, x) => (!w || LEVEL_RANK[x.ev.overall] > LEVEL_RANK[w.ev.overall] ? x : w), null)

  let subtitle
  if (loading) subtitle = 'Calcul en cours…'
  else if (!list.length) subtitle = 'Rien noté pour ce jour'
  else if (!worst) subtitle = 'Pas assez de données pour ce jour'
  else if (FODMAP_NOTABLE.has(worst.ev.overall)) subtitle = `Repas le plus chargé : ${worst.meal}`
  else if (worst.ev.overall === 'low') subtitle = 'Tous tes repas restent sous les seuils'
  else subtitle = 'Sous les seuils d’après les données connues'

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={toggleCollapsed}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left' }}
      >
        <ChevronDown
          size={16}
          color="var(--text-hint)"
          style={{ flexShrink: 0, transition: 'transform .2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wheat size={14} color="var(--green)" />
            <span style={{ fontWeight: 700, fontSize: 14 }}>FODMAP</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>
        </div>
        {worst && <FodmapPill level={worst.ev.overall} text={MEAL_LABEL[worst.ev.overall]} />}
      </button>

      {!collapsed && rated.length > 0 && (
        <div style={{ padding: '0 14px 12px' }}>
          {list.map(({ meal, ev }) => (
            ev.overall
              ? <MealBlock key={meal} meal={meal} ev={ev} />
              : (
                <div key={meal} style={{ padding: '10px 0', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{meal}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>non compté</span>
                </div>
              )
          ))}

          <button
            onClick={() => setAboutOpen(o => !o)}
            style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font)' }}
          >
            {aboutOpen ? 'Masquer l’explication' : 'Comment c’est calculé ?'}
          </button>
          {aboutOpen && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 6 }}>
              Les FODMAP des aliments d’un même repas s’additionnent : plusieurs aliments faibles
              peuvent ensemble dépasser le seuil. Il n’existe pas de seuil officiel par repas, alors
              chaque aliment compte pour la part de son seuil qu’il représente (la moitié du seuil,
              le quart…), famille par famille. Au-delà d’une fois le seuil, le repas est « modéré »,
              au-delà de deux fois « élevé ». Chaque repas est compté à part. C’est une information,
              pas un conseil médical.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
