import React from 'react'
import { ChevronDown } from 'lucide-react'
import { PHASES } from '../lib/cycle'

// ─────────────────────────────────────────────────────────────────────────────
// CalendarDayMarkers — repères d'une case de calendrier, partagés par la vue
// Mois (CalendarMonthGrid) et la vue Semaine (CalendarWeekStrip) pour éviter
// que l'une prenne du retard sur l'autre. Une signification par ZONE :
//
//   • coin haut-droite  → repas / complément prévu   (violet = à venir, corail = raté)
//   • coin haut-gauche  → séance de sport ce jour-là (vert)
//   • barre pleine largeur en bas → phase de cycle (couleur de la phase ;
//                          jour de règles = barre corail plus épaisse)
//
// Le fond de la case (régularité : vert / corail / neutre) et le contour
// « aujourd'hui » restent gérés par la case elle-même. À placer dans un parent
// `position: relative`.
//
// Props — `marks` :
//   planned    : 'planned' | 'missed' | falsy
//   hasSport   : bool
//   phaseColor : string | null   couleur CSS de la phase (hors règles)
//   isPeriod   : bool            jour de règles → barre corail épaisse
//   isSelected : bool            case sélectionnée → repères en blanc, pas de barre
//   compact    : bool            cases de mois (petites) → tailles réduites
// ─────────────────────────────────────────────────────────────────────────────
export default function CalendarDayMarkers({ marks }) {
  const { planned, hasSport, phaseColor, isPeriod, isSelected, compact } = marks
  const dot = compact ? 5 : 6
  const inset = compact ? 3 : 4
  const white = isSelected

  return (
    <>
      {planned && (
        <span style={{
          position: 'absolute', top: inset, right: inset,
          width: dot, height: dot, borderRadius: '50%',
          background: white ? '#fff' : (planned === 'missed' ? 'var(--coral)' : 'var(--purple)'),
        }} />
      )}
      {hasSport && (
        <span style={{
          position: 'absolute', top: inset, left: inset,
          width: dot, height: dot, borderRadius: '50%',
          background: white ? '#fff' : 'var(--green)',
        }} />
      )}
      {(isPeriod || phaseColor) && !isSelected && (
        <span style={{
          position: 'absolute', left: inset, right: inset, bottom: compact ? 2 : 3,
          height: isPeriod ? 3 : 2, borderRadius: 2,
          background: isPeriod ? 'var(--coral)' : phaseColor,
          opacity: isPeriod ? 0.9 : 0.55,
        }} />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarLegend — légende repliable, groupée par zone. Fermée par défaut pour
// ne pas alourdir la carte. Les blocs cycle / sport n'apparaissent que si les
// options correspondantes sont actives (props showCycle / showSport).
// ─────────────────────────────────────────────────────────────────────────────
export function CalendarLegend({ showCycle, showSport, open, onToggle }) {
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', padding: '2px 0',
          fontSize: 11, fontWeight: 700, color: 'var(--text-hint)', fontFamily: 'var(--font)',
        }}
      >
        Légende
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <Row>
            <Swatch bg="var(--green-light)" /> objectifs atteints
            <span style={{ margin: '0 4px', color: 'var(--border-md)' }}>·</span>
            <Swatch bg="var(--coral-light)" /> trop / pas assez
          </Row>
          <Row>
            <Dot color="var(--purple)" /> repas prévu
            <span style={{ margin: '0 4px', color: 'var(--border-md)' }}>·</span>
            <Dot color="var(--coral)" /> repas manqué
            <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 4 }}>(coin haut-droite)</span>
          </Row>
          {showSport && (
            <Row>
              <Dot color="var(--green)" /> séance de sport
              <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 4 }}>(coin haut-gauche)</span>
            </Row>
          )}
          {showCycle && (
            <Row>
              <Bar color="var(--coral)" thick /> règles
              <span style={{ margin: '0 4px', color: 'var(--border-md)' }}>·</span>
              <Bar color={PHASES.luteale.color} /> phase lutéale
              <span style={{ margin: '0 4px', color: 'var(--border-md)' }}>·</span>
              <Bar color={PHASES.folliculaire.color} /> folliculaire
              <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 4 }}>(barre en bas)</span>
            </Row>
          )}
          <Row>
            <span style={{ textDecoration: 'line-through', color: 'var(--text-hint)', fontWeight: 700 }}>12</span>
            <span style={{ marginLeft: 4 }}>jour exclu des stats</span>
          </Row>
        </div>
      )}
    </div>
  )
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}
function Swatch({ bg }) {
  return <span style={{ width: 12, height: 12, borderRadius: 4, background: bg, marginRight: 5, flexShrink: 0 }} />
}
function Dot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, marginRight: 5, flexShrink: 0 }} />
}
function Bar({ color, thick }) {
  return <span style={{ width: 14, height: thick ? 3 : 2, borderRadius: 2, background: color, marginRight: 5, flexShrink: 0 }} />
}
