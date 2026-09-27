// ─────────────────────────────────────────────────────────────────────────────
// Croisements sommeil ↔ journée (chantier « Suivi du sommeil », Paliers 3-4 —
// voir docs/suivi-sommeil.md §4.4, §4.5 et §5.4). Fonctions pures, AUCUN
// accès réseau (fait par useSleepInsights, src/hooks/useSleepInsights.js).
//
// SOURCE DE VÉRITÉ UNIQUE : l'onglet Sommeil de l'Historique ET le conseil du
// jour après une nuit courte (Palier 5) passent tous deux par
// computeSleepInsights — jamais par un calcul parallèle.
//
// Principe statistique (§5.4) :
//   1. jours utilisables seulement (non exclus, journée plausiblement
//      complète : kcal ≥ 40 % de l'objectif, et jamais la journée en cours,
//      forcément incomplète — repas, pas et séances) ;
//   2. écrêtage 5ᵉ–95ᵉ percentile de l'indicateur (une fête ≠ une tendance) ;
//   3. comparaison À SITUATION COMPARABLE : strates semaine/week-end ×
//      phase lutéale/reste du cycle ; dans chaque strate on retranche la
//      moyenne de la strate (au prédicteur ET à l'indicateur) → on ne compare
//      plus que des écarts à l'habitude du même type de jour ;
//   4. deux groupes (« nuits courtes » = ≥ 45 min sous l'habitude de la
//      strate, vs les autres), moyennes ajustées, t de Welch ;
//   5. niveau de confiance en mots, seuil exigeant (on teste ~10 indicateurs).
// ─────────────────────────────────────────────────────────────────────────────
import { isWeekendDate, addDaysStr, timeToMin } from './sleep'
import { phaseForDate } from './cycle'
import { todayStr } from './dates'

export const INSIGHT_WINDOW_DAYS = 90
const MIN_DAYS = 20      // jours utilisables minimum pour un croisement nuit → journée
const MIN_LOW = 6        // nuits courtes (ou mauvaises) minimum, et autant de normales
const MIN_FACTOR = 5     // nuits avec / sans un facteur, minimum
const MIN_STRATUM = 3    // strate trop petite → écartée
const T_TREND = 1.5
const T_NET = 2.5
const PLAUSIBLE_SHARE = 0.4

export const CONFIDENCE_LABELS = {
  net: 'Lien net',
  tendance: 'Tendance, à confirmer',
  aucun: 'Pas de différence visible',
  pas_assez: 'Pas encore assez de données',
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
function variance(a) {
  if (a.length < 2) return 0
  const m = mean(a)
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)
}
function welchT(a, b) {
  const se = Math.sqrt(variance(a) / a.length + variance(b) / b.length)
  if (!se) return 0
  return (mean(a) - mean(b)) / se
}
function confidenceOf(t) {
  const at = Math.abs(t)
  if (at >= T_NET) return 'net'
  if (at >= T_TREND) return 'tendance'
  return 'aucun'
}
function winsorizer(values) {
  if (values.length < 20) return (v) => v
  const s = [...values].sort((a, b) => a - b)
  const lo = s[Math.floor(0.05 * (s.length - 1))]
  const hi = s[Math.ceil(0.95 * (s.length - 1))]
  if (lo === hi) return (v) => v // indicateur quasi binaire : ne pas tout aplatir
  return (v) => Math.min(hi, Math.max(lo, v))
}

// Retranche la moyenne de sa strate à chaque valeur listée dans `keys`.
// Strates de moins de MIN_STRATUM points écartées.
function residualize(points, keys) {
  const groups = {}
  for (const p of points) (groups[p.s] ||= []).push(p)
  const out = []
  let k = 0
  for (const list of Object.values(groups)) {
    if (list.length < MIN_STRATUM) continue
    k++
    const means = Object.fromEntries(keys.map(key => [key, mean(list.map(p => p[key]))]))
    for (const p of list) {
      const r = { ...p }
      for (const key of keys) r[key + 'r'] = p[key] - means[key]
      out.push(r)
    }
  }
  return { rows: out, strata: k }
}

// ── Moteur « nuit → journée » ──────────────────────────────────────────────
// points : [{ x, y, s }] — x = prédicteur (durée en min, ou qualité 1–5),
// y = indicateur du jour, s = clé de strate. isLow(row) classe une nuit dans
// le groupe « nuit courte / mauvaise » (row porte x, xr = écart à l'habitude
// de la strate). slopeScale convertit la pente (y par unité de x) en « effet
// d'une unité de sommeil EN MOINS » (−60 pour la durée : par heure).
export function sleepEffect(points, { isLow, slopeScale = -1, winsorize = true }) {
  const pts = points.filter(p => p.x != null && p.y != null && isFinite(p.x) && isFinite(p.y))
  const clamp = winsorize ? winsorizer(pts.map(p => p.y)) : (v) => v
  const { rows, strata } = residualize(pts.map(p => ({ ...p, y: clamp(p.y) })), ['x', 'y'])
  const low = rows.filter(isLow)
  const normal = rows.filter(r => !isLow(r))
  const base = { n: rows.length, nLow: low.length, nNormal: normal.length, minDays: MIN_DAYS, minLow: MIN_LOW }
  if (rows.length < MIN_DAYS || low.length < MIN_LOW || normal.length < MIN_LOW) {
    return { ...base, confidence: 'pas_assez' }
  }
  const grand = mean(rows.map(r => r.y))
  const meanLow = grand + mean(low.map(r => r.yr))
  const meanNormal = grand + mean(normal.map(r => r.yr))
  const t = welchT(low.map(r => r.yr), normal.map(r => r.yr))

  // Pente (régression sur les écarts) → « par heure de sommeil en moins ».
  let perUnit = null, slopeT = 0
  const sxx = rows.reduce((s, r) => s + r.xr * r.xr, 0)
  const df = rows.length - strata - 1
  if (sxx > 0 && df >= 5) {
    const b = rows.reduce((s, r) => s + r.xr * r.yr, 0) / sxx
    const resid = rows.reduce((s, r) => s + (r.yr - b * r.xr) ** 2, 0)
    const se = Math.sqrt(resid / df / sxx)
    slopeT = se ? b / se : 0
    perUnit = b * slopeScale
  }
  return {
    ...base,
    meanLow, meanNormal, diff: meanLow - meanNormal,
    t, confidence: confidenceOf(t),
    perUnit: Math.abs(slopeT) >= T_TREND ? perUnit : null,
  }
}

// ── Moteur « facteur → nuit » ──────────────────────────────────────────────
// points : [{ has: bool, y, s }] — y = durée ou qualité de la nuit.
export function factorEffect(points) {
  const pts = points.filter(p => p.y != null && isFinite(p.y))
  const { rows } = residualize(pts, ['y'])
  const withF = rows.filter(r => r.has)
  const without = rows.filter(r => !r.has)
  const base = { nWith: withF.length, nWithout: without.length, minFactor: MIN_FACTOR }
  if (withF.length < MIN_FACTOR || without.length < MIN_FACTOR) return { ...base, confidence: 'pas_assez' }
  const grand = mean(rows.map(r => r.y))
  const t = welchT(withF.map(r => r.yr), without.map(r => r.yr))
  return {
    ...base,
    meanWith: grand + mean(withF.map(r => r.yr)),
    meanWithout: grand + mean(without.map(r => r.yr)),
    diff: mean(withF.map(r => r.yr)) - mean(without.map(r => r.yr)),
    t, confidence: confidenceOf(t),
  }
}

// ── Détection de l'alcool dans le journal ─────────────────────────────────
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const ALCOHOL_RE = /\b(vin|vins|biere|bieres|cidre|champagne|cremant|prosecco|cocktail|mojito|spritz|sangria|rhum|whisky|vodka|gin|tequila|cognac|armagnac|calvados|pastis|liqueur|porto|kir|martini|apero|aperitif anise)\b/
const NOT_ALCOHOL_RE = /sans alcool|0[.,]0 ?%|vinaigre|au vin|a la biere|sauce/
export function isAlcoholFood(name) {
  const n = norm(name)
  return ALCOHOL_RE.test(n) && !NOT_ALCOHOL_RE.test(n)
}

// ── Facteurs de contexte cochés dans la feuille (colonne sommeil.facteurs) ─
export const SLEEP_FACTORS = [
  { key: 'cafe_tard', label: 'Café tardif', emoji: '☕' },
  { key: 'alcool', label: 'Alcool', emoji: '🍷' },
  { key: 'repas_tardif', label: 'Repas tardif', emoji: '🍽️' },
  { key: 'ecrans', label: 'Écrans tard', emoji: '📱' },
  { key: 'stress', label: 'Stress', emoji: '😰' },
  { key: 'chaleur', label: 'Chaleur', emoji: '🌡️' },
  { key: 'bruit', label: 'Bruit', emoji: '🔊' },
  { key: 'douleurs', label: 'Douleurs', emoji: '🤕' },
  { key: 'malade', label: 'Malade', emoji: '🤒' },
]

// ── Indicateurs de la journée (Palier 3) ──────────────────────────────────
// binary : valeur 0/1, affichée en points de %, pas d'écrêtage.
export const SLEEP_OUTCOMES = [
  { key: 'kcal', label: 'Calories', unit: 'kcal', source: 'food', primary: true },
  { key: 'collation', label: 'Calories en collation', unit: 'kcal', source: 'food' },
  { key: 'soir', label: 'Part du dîner et des collations', unit: '%', source: 'food' },
  { key: 'sucres', label: 'Sucres', unit: 'g', source: 'food' },
  { key: 'lipides', label: 'Lipides', unit: 'g', source: 'food' },
  { key: 'proteines', label: 'Protéines', unit: 'g', source: 'food' },
  { key: 'pas', label: 'Pas', unit: 'pas', source: 'pas' },
  { key: 'seance', label: 'Jours avec une séance de sport', unit: '%', source: 'sport', binary: true },
]

// Agrège les entrées journal par date (kcal, macros, collations, dîner,
// alcool) et marque les journées plausiblement complètes.
export function buildFoodByDate(journal, excludedDates, goalKcal) {
  const by = {}
  for (const e of journal || []) {
    const d = (by[e.date] ||= { kcal: 0, sucres: 0, lipides: 0, proteines: 0, collation: 0, diner: 0, alcool: false })
    const k = Number(e.energie_kcal) || 0
    d.kcal += k
    d.sucres += Number(e.sucres) || 0
    d.lipides += Number(e.lipides) || 0
    d.proteines += Number(e.proteines) || 0
    if (e.meal === 'Collation') d.collation += k
    if (e.meal === 'Dîner') d.diner += k
    if (!d.alcool && isAlcoholFood(e.food_name)) d.alcool = true
  }
  const floor = PLAUSIBLE_SHARE * (Number(goalKcal) || 1800)
  for (const [date, d] of Object.entries(by)) {
    d.plausible = !excludedDates?.has(date) && d.kcal >= floor
    d.soir = d.kcal > 0 ? (d.diner + d.collation) / d.kcal : null
    d.dinerShare = d.kcal > 0 ? d.diner / d.kcal : null
  }
  return by
}

function median(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

// ── Point d'entrée ─────────────────────────────────────────────────────────
// Toutes les entrées sont déjà restreintes à la fenêtre (INSIGHT_WINDOW_DAYS
// jours jusqu'à endDate, + la veille du premier jour pour les facteurs).
//   nights      : lignes `sommeil`
//   journal     : lignes `journal` (date, meal, energie_kcal, sucres, lipides, proteines, food_name)
//   activities  : lignes `activites_sport` (date, duree_min, heure_debut)
//   pasByDate   : { date: nb_pas }
//   settings    : réglages fusionnés (goal_kcal, sommeil, sport, cycle)
//   cycleDays   : jours de règles (useCycle)
export function computeSleepInsights({ nights, journal, excludedDates, activities, pasByDate, settings, cycleDays, endDate }) {
  const startDate = addDaysStr(endDate, -(INSIGHT_WINDOW_DAYS - 1))
  const windowNights = (nights || []).filter(n => n.date >= startDate && n.date <= endDate)
  const nightByDate = new Map((nights || []).map(n => [n.date, n]))
  const food = buildFoodByDate(journal, excludedDates, settings?.goal_kcal)
  const actByDate = {}
  for (const a of activities || []) (actByDate[a.date] ||= []).push(a)

  const cycleCfg = settings?.cycle
  const useCycle = !!cycleCfg?.enabled && !cycleCfg?.sous_contraception && (cycleDays || []).length > 0
  const phaseOf = (d) => (useCycle ? phaseForDate(d, cycleDays, cycleCfg) : null)
  const stratum = (d) => `${isWeekendDate(d) ? 'we' : 'sem'}|${phaseOf(d) === 'luteale' ? 'lut' : '-'}`
  const sportOn = !!settings?.sport?.enabled
  const seuil = Number(settings?.sommeil?.seuil_nuit_courte_min) || 45

  // ── Palier 3 : nuit (date D) → journée D ────────────────────────────────
  const today = todayStr()
  const outcomeValue = (o, d) => {
    if (d >= today) return null
    if (o.source === 'food') {
      const f = food[d]
      if (!f?.plausible) return null
      return o.key === 'soir' ? (f.soir == null ? null : f.soir * 100) : f[o.key]
    }
    if (o.source === 'pas') return pasByDate?.[d] > 0 ? pasByDate[d] : null
    if (o.source === 'sport') return sportOn ? ((actByDate[d] || []).length > 0 ? 100 : 0) : null
    return null
  }
  const outcomes = SLEEP_OUTCOMES
    .filter(o => (o.source !== 'sport' || sportOn))
    .map(o => {
      const byDuration = sleepEffect(
        windowNights.map(n => ({ x: n.duree_min, y: outcomeValue(o, n.date), s: stratum(n.date) })),
        { isLow: r => r.xr <= -seuil, slopeScale: -60, winsorize: !o.binary },
      )
      const byQuality = sleepEffect(
        windowNights.filter(n => n.qualite != null).map(n => ({ x: Number(n.qualite), y: outcomeValue(o, n.date), s: stratum(n.date) })),
        { isLow: r => r.x <= 2, slopeScale: -1, winsorize: !o.binary },
      )
      return { ...o, byDuration, byQuality }
    })

  // ── Palier 4 : veille (D−1) / contexte → nuit D ─────────────────────────
  const pasVals = Object.values(pasByDate || {}).filter(v => v > 0)
  const pasMedian = median(pasVals)
  const prev = (d) => addDaysStr(d, -1)
  const hasTag = (n, key) => (n.facteurs || []).includes(key)
  const autoFactors = [
    sportOn && { key: 'sport_veille', label: 'Séance de sport dans la journée', emoji: '🏃', has: (n) => (actByDate[prev(n.date)] || []).length > 0 },
    sportOn && {
      key: 'sport_tardif', label: 'Séance après 19 h', emoji: '🌆',
      has: (n) => (actByDate[prev(n.date)] || []).some(a => (timeToMin(a.heure_debut) ?? 0) >= 19 * 60),
    },
    pasMedian && { key: 'pas_eleves', label: 'Beaucoup de pas dans la journée', emoji: '👟', has: (n) => (pasByDate[prev(n.date)] || 0) >= 1.3 * pasMedian },
    { key: 'diner_copieux', label: 'Dîner copieux (plus de 40 % de la journée)', emoji: '🍝', has: (n) => { const f = food[prev(n.date)]; return !!f?.plausible && f.dinerShare > 0.4 } },
    { key: 'alcool', label: 'Alcool', emoji: '🍷', has: (n) => !!food[prev(n.date)]?.alcool || hasTag(n, 'alcool') },
    { key: 'sieste', label: 'Sieste de plus de 30 min', emoji: '😴', has: (n) => (Number(nightByDate.get(prev(n.date))?.sieste_min) || 0) >= 30 },
    useCycle && { key: 'regles', label: 'Pendant les règles', emoji: '🩸', has: (n) => phaseOf(n.date) === 'menstruelle' },
    useCycle && { key: 'luteale', label: 'En phase lutéale', emoji: '🌙', has: (n) => phaseOf(n.date) === 'luteale' },
  ].filter(Boolean)
  const tagFactors = SLEEP_FACTORS
    .filter(f => f.key !== 'alcool') // fusionné avec la détection automatique
    .map(f => ({ ...f, has: (n) => hasTag(n, f.key) }))

  // Strate des facteurs : semaine / week-end seulement (la phase du cycle est
  // elle-même un facteur).
  const nightStratum = (d) => (isWeekendDate(d) ? 'we' : 'sem')
  const factors = [...autoFactors, ...tagFactors].map(f => {
    const duration = factorEffect(windowNights.map(n => ({ has: f.has(n), y: n.duree_min, s: nightStratum(n.date) })))
    const quality = factorEffect(windowNights.filter(n => n.qualite != null).map(n => ({ has: f.has(n), y: Number(n.qualite), s: nightStratum(n.date) })))
    const seen = windowNights.filter(f.has).length
    return { key: f.key, label: f.label, emoji: f.emoji, duration, quality, seen }
  })

  return { startDate, endDate, nNights: windowNights.length, outcomes, factors }
}

// ── Affichage ──────────────────────────────────────────────────────────────
const nf = (v) => Math.round(v).toLocaleString('fr-FR')
export function formatOutcomeValue(o, v) {
  if (v == null) return '—'
  if (o.unit === '%') return `${Math.round(v)} %`
  if (o.unit === 'pas') return `${nf(v)} pas`
  return `${nf(v)} ${o.unit}`
}
export function formatOutcomeDiff(o, d) {
  if (d == null) return '—'
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  const a = Math.abs(d)
  if (o.unit === '%') return `${sign}${Math.round(a)} pts`
  if (o.unit === 'pas') return `${sign}${nf(a)} pas`
  return `${sign}${nf(a)} ${o.unit}`
}
