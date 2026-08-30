// Helpers purs de la page Historique (src/pages/HistoryPage.jsx) — bornes de
// période, statut d'un jour, lissage de courbe. Sortis de la page pour être
// réutilisés par ses composants graphiques (src/components/history/*) et
// testables isolément.

// ── Estimation poids ────────────────────────────────────────────────────────
// ~7700 kcal par kilo de masse → 7.7 kcal/g. Sert à traduire le bilan
// énergétique cumulé d'une période (Σ kcal jour − objectif) en grammes.
export const EST_KCAL_PER_G = 7.7

// ── Statut d'un jour selon ses kcal vs objectif ─────────────────────────────
// Source unique de la couleur d'un jour : barre du graphe, case de la heatmap,
// carte jour/mois du détail. Écarts par rapport à l'objectif :
//   off       : ≥ 200 au-dessus            (bien au-dessus)   — coral
//   over      : 1 à 199 au-dessus          (un peu au-dessus) — amber
//   ok        : de l'objectif à 300 sous   (dans l'objectif)  — vert
//   under     : 301 à 600 sous             (un peu en dessous) — bleu
//   way_under : > 600 sous                 (bien en dessous)   — bleu foncé
// Chaud = au-dessus, froid = en dessous, vert = dans la cible.
export const STATUS_COLOR = {
  none:      'var(--border-md)',
  ok:        'var(--green)',
  over:      'var(--amber)',
  off:       'var(--coral)',
  under:     'var(--blue)',
  way_under: 'var(--blue-dark)',
}
export const STATUS_BG = {
  none:      'transparent',
  ok:        'var(--green-light)',
  over:      'var(--amber-light)',
  off:       'var(--coral-light)',
  under:     'var(--blue-light)',
  way_under: 'rgba(24, 95, 165, 0.16)',
}

// Seuils (kcal) sous l'objectif — modifiables si besoin.
export const UNDER_OK = 300      // jusqu'ici sous l'objectif = encore "dans l'objectif"
export const UNDER_A_LOT = 600   // au-delà = "bien en dessous"

export function dayStatus(kcal, goalKcal) {
  if (!kcal) return 'none'
  const diff = kcal - goalKcal
  if (diff >= 200) return 'off'
  if (diff > 0) return 'over'
  if (diff >= -UNDER_OK) return 'ok'
  if (diff >= -UNDER_A_LOT) return 'under'
  return 'way_under'
}

// ── Bornes [start, end] (inclus, 'YYYY-MM-DD') de la période + libellé FR ────
export function getPeriodBounds(tab, anchor) {
  const d = new Date(anchor + 'T12:00:00')

  if (tab === 'jour') {
    return { start: anchor, end: anchor, label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  }

  if (tab === 'semaine') {
    const dow = d.getDay() || 7 // lundi=1 ... dimanche=7
    const monday = new Date(d); monday.setDate(d.getDate() - dow + 1)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const fmtD = (dt, withYear) => dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined })
    return {
      start: isoLocal(monday),
      end: isoLocal(sunday),
      label: `${fmtD(monday)} – ${fmtD(sunday, true)}`,
    }
  }

  if (tab === 'mois') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start: isoLocal(start), end: isoLocal(end), label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
  }

  // année
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()}` }
}

export function shiftAnchor(tab, anchor, dir) {
  const d = new Date(anchor + 'T12:00:00')
  if (tab === 'jour') d.setDate(d.getDate() + dir)
  else if (tab === 'semaine') d.setDate(d.getDate() + dir * 7)
  else if (tab === 'mois') d.setMonth(d.getMonth() + dir)
  else d.setFullYear(d.getFullYear() + dir)
  return isoLocal(d)
}

// 'YYYY-MM-DD' en fuseau LOCAL (comme lib/dates.fmt) — `toISOString().slice(0,10)`
// bascule d'un jour aux heures proches de minuit en France.
function isoLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Liste ordonnée des dates 'YYYY-MM-DD' de start à end inclus.
export function eachDay(start, end) {
  const out = []
  const d = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (d <= last) {
    out.push(isoLocal(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// ── Lissage de courbe (Catmull-Rom → Bézier cubique) ────────────────────────
// Repris tel quel de src/components/MetricChart.jsx (helper non exporté là-bas)
// pour la variante "Année" du graphique de tendance.
export function smoothPath(coords) {
  if (coords.length < 2) return ''
  if (coords.length === 2) return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`
  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}
