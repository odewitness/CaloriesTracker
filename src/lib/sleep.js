// ─────────────────────────────────────────────────────────────────────────────
// Suivi du sommeil (table `sommeil`) — helpers purs. Voir docs/suivi-sommeil.md.
//
// Convention centrale : une nuit est rattachée à la DATE DU RÉVEIL (la nuit
// du 26 au 27 est enregistrée au 27). `duree_min` est la source de vérité de
// toutes les stats ; les deux heures (nullable) servent à la régularité, aux
// horaires habituels et au chronotype.
//
// Heures : chaînes 'HH:MM' (ou 'HH:MM:SS' telles que renvoyées par Postgres).
// Pour tout calcul sur des heures qui passent minuit, on travaille en
// « minutes depuis midi la veille » (bedOffset / wakeOffset) ou en statistique
// circulaire (circularStats) — jamais en moyenne arithmétique d'heures
// d'horloge (moyenne de 23:30 et 00:30 ≠ 12:00).
// ─────────────────────────────────────────────────────────────────────────────
import { fmt } from './dates'
import { formatDuree } from './sport'

export const SLEEP_DEFAULTS = {
  card_visible: true,
  objectif_min: 480,          // 8 h
  seuil_nuit_courte_min: 45,  // sous l'habitude (Palier 3/5)
  conseils_jour: true,        // Palier 5
  afficher_calendrier: false, // Palier 6
}

// Fusionne le bloc `settings.sommeil` brut avec les défauts (même principe que
// mergeWaterSettings) — tolère un bloc partiel ou absent.
export function mergeSleepSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return { ...SLEEP_DEFAULTS, ...s }
}

export const SLEEP_QUALITES = [
  { value: 1, emoji: '😫', label: 'Très mauvaise' },
  { value: 2, emoji: '😕', label: 'Mauvaise' },
  { value: 3, emoji: '😐', label: 'Moyenne' },
  { value: 4, emoji: '🙂', label: 'Bonne' },
  { value: 5, emoji: '😄', label: 'Excellente' },
]
export function sleepQualite(value) {
  return SLEEP_QUALITES.find(q => q.value === Number(value)) || null
}

export const DEFAULT_BEDTIME = '23:00'
export const DEFAULT_WAKE = '07:00'
const HABIT_NIGHTS = 14 // nuits récentes prises en compte pour les horaires habituels

// ── Petits utilitaires ─────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
function median(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + n, 12))
}

// Samedi ou dimanche (date du réveil) : nuits du vendredi au samedi et du
// samedi au dimanche.
export function isWeekendDate(dateStr) {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

// '23:40' / '23:40:00' → 1420 ; vide ou invalide → null.
export function timeToMin(t) {
  if (!t) return null
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

// 1420 → '23:40' (modulo 24 h, accepte des minutes négatives ou > 1440).
export function minToTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function formatHeureSommeil(t) {
  const m = timeToMin(t)
  return m == null ? null : minToTime(m)
}

export function shiftTime(t, deltaMin) {
  const m = timeToMin(t)
  return minToTime((m ?? 0) + deltaMin)
}

// 445 → « 7 h 25 » (même format que les séances de sport).
export function formatDureeSommeil(min) {
  return formatDuree(min)
}

// Écart signé en minutes → « +25 min » / « −1 h 10 » / « pile ».
export function formatEcart(min) {
  const m = Math.round(min)
  if (m === 0) return 'pile'
  return `${m > 0 ? '+' : '−'}${formatDuree(Math.abs(m))}`
}

// « Nuit du 26 au 27 » (dateStr = date du réveil) ; à cheval sur deux mois :
// « Nuit du 30 sept. au 1er oct. ».
export function nightLabel(dateStr) {
  const wake = new Date(dateStr + 'T12:00:00')
  const bed = new Date(wake); bed.setDate(bed.getDate() - 1)
  const day = (d) => (d.getDate() === 1 ? '1er' : String(d.getDate()))
  const month = (d) => d.toLocaleDateString('fr-FR', { month: 'short' })
  if (bed.getMonth() === wake.getMonth()) return `Nuit du ${day(bed)} au ${day(wake)}`
  return `Nuit du ${day(bed)} ${month(bed)} au ${day(wake)} ${month(wake)}`
}

// ── Fenêtre de sommeil et durée ────────────────────────────────────────────
// Place l'endormissement la veille s'il est après midi, le jour même sinon
// (01:15 → 08:00), puis calcule l'écart avec de vrais objets Date en heure
// locale : les nuits de changement d'heure (fin mars / fin octobre) durent
// donc bien 1 h de moins / de plus que ce que disent les horloges.
// Retourne { start, end, minutes } ou null si une heure manque.
export function sleepWindow(dateStr, heureEndormissement, heureReveil) {
  const b = timeToMin(heureEndormissement)
  const w = timeToMin(heureReveil)
  if (!dateStr || b == null || w == null) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  const end = new Date(y, mo - 1, d, Math.floor(w / 60), w % 60)
  let start = new Date(y, mo - 1, b >= 720 ? d - 1 : d, Math.floor(b / 60), b % 60)
  if (start >= end) start = new Date(y, mo - 1, d - 1, Math.floor(b / 60), b % 60)
  return { start, end, minutes: Math.round((end - start) / 60000) }
}

// Minutes « depuis midi la veille » (horloge, sans correction de changement
// d'heure — voulu pour la régularité) : endormissement 23:00 → 660,
// 01:00 → 780 ; réveil 07:00 → 1140. Plage continue sur une nuit.
export function bedOffset(t) {
  const m = timeToMin(t)
  return m == null ? null : (m >= 720 ? m - 720 : m + 720)
}
export function wakeOffset(t) {
  const m = timeToMin(t)
  return m == null ? null : m + 720
}

// Fenêtre d'une nuit en offsets, ou null (heure manquante / incohérente).
function nightOffsets(n) {
  const b = bedOffset(n.heure_endormissement)
  const w = wakeOffset(n.heure_reveil)
  if (b == null || w == null || b >= w) return null
  return { b, w, mid: b + (w - b) / 2 }
}

// Efficacité = durée dormie / fenêtre endormissement → réveil (null sans heures).
export function sleepEfficiency(n) {
  const win = sleepWindow(n.date, n.heure_endormissement, n.heure_reveil)
  if (!win || win.minutes <= 0) return null
  return Math.min(1, n.duree_min / win.minutes)
}

// ── Statistique circulaire (heures sur 24 h) ───────────────────────────────
// mins : minutes d'horloge (0–1439). Moyenne via angles, puis médiane et
// écart-type des écarts à cette moyenne ramenés dans [−12 h, +12 h).
export function circularStats(mins) {
  const v = (mins || []).filter(x => x != null)
  if (!v.length) return null
  let s = 0, c = 0
  for (const m of v) {
    const a = (m / 1440) * 2 * Math.PI
    s += Math.sin(a); c += Math.cos(a)
  }
  const meanMin = (((Math.atan2(s, c) / (2 * Math.PI)) * 1440) + 1440) % 1440
  const offs = v.map(m => ((((m - meanMin + 720) % 1440) + 1440) % 1440) - 720)
  const medOff = median(offs)
  return {
    mean: meanMin,
    median: (meanMin + medOff + 1440) % 1440,
    sd: Math.sqrt(mean(offs.map(o => o * o))),
    n: v.length,
  }
}

// ── Horaires habituels (pré-remplissage, « Comme d'habitude ») ─────────────
// Médiane circulaire des 14 dernières nuits AVANT `dateStr` du même type de
// jour (semaine / week-end, selon la date du réveil) ; repli sur toutes les
// nuits récentes si moins de 3 du même type. La durée proposée retranche le
// temps éveillé habituel (fenêtre − durée notée). null si aucune nuit passée
// avec heures.
export function usualTimes(nights, dateStr) {
  const prior = (nights || [])
    .filter(n => n.date < dateStr)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const withTimes = prior.filter(n => n.heure_endormissement && n.heure_reveil)
  const we = isWeekendDate(dateStr)
  let pool = withTimes.filter(n => isWeekendDate(n.date) === we).slice(0, HABIT_NIGHTS)
  if (pool.length < 3) pool = withTimes.slice(0, HABIT_NIGHTS)
  if (!pool.length) return null

  const bed = minToTime(circularStats(pool.map(n => timeToMin(n.heure_endormissement))).median)
  const wake = minToTime(circularStats(pool.map(n => timeToMin(n.heure_reveil))).median)
  const win = sleepWindow(dateStr, bed, wake)
  const awake = median(pool.map(n => {
    const w = sleepWindow(n.date, n.heure_endormissement, n.heure_reveil)
    return w ? Math.max(0, w.minutes - n.duree_min) : 0
  })) || 0

  const natPool = prior.filter(n => isWeekendDate(n.date) === we && n.reveil_naturel != null).slice(0, HABIT_NIGHTS)
  const reveilNaturel = natPool.length >= 3
    ? natPool.filter(n => n.reveil_naturel).length / natPool.length >= 0.6
    : null

  return {
    heure_endormissement: bed,
    heure_reveil: wake,
    duree_min: win ? Math.max(0, Math.round(win.minutes - awake)) : null,
    reveil_naturel: reveilNaturel,
  }
}

// ── Manque de sommeil accumulé (« dette ») ─────────────────────────────────
// Sur les nuits NOTÉES des `days` derniers jours jusqu'à dateStr inclus : une
// nuit plus longue que l'objectif ne rembourse que la moitié de son surplus.
// null si moins de 4 nuits notées (pas assez pour parler de tendance).
export function sleepDebt(nights, dateStr, objectifMin, days = 7) {
  const from = addDaysStr(dateStr, -(days - 1))
  const list = (nights || []).filter(n => n.date >= from && n.date <= dateStr)
  if (list.length < 4) return null
  let deficit = 0, surplus = 0
  for (const n of list) {
    const d = objectifMin - n.duree_min
    if (d > 0) deficit += d
    else surplus += -d
  }
  return { minutes: Math.max(0, Math.round(deficit - 0.5 * surplus)), n: list.length }
}

// Les `count` derniers jours jusqu'à dateStr inclus : [{ date, night|null }].
export function lastNights(nights, dateStr, count = 7) {
  const byDate = new Map((nights || []).map(n => [n.date, n]))
  const out = []
  for (let i = count - 1; i >= 0; i--) {
    const d = addDaysStr(dateStr, -i)
    out.push({ date: d, night: byDate.get(d) || null })
  }
  return out
}

// ── Régularité : Sleep Regularity Index (Phillips 2017) ────────────────────
// Chaque nuit est vue comme 24 h (de midi la veille à midi le jour du réveil)
// découpées en tranches de 15 min « endormie » / « éveillée ». Pour chaque
// paire de nuits CONSÉCUTIVES notées avec les deux heures, on compte les
// tranches dans le même état à 24 h d'écart. SRI = 200 × accord − 100,
// ramené à 0–100. Au moins 5 paires, sinon null.
const SRI_STEP = 15
const SRI_SLOTS = 1440 / SRI_STEP
function asleepMask(n) {
  const o = nightOffsets(n)
  if (!o) return null
  const mask = new Array(SRI_SLOTS)
  for (let k = 0; k < SRI_SLOTS; k++) {
    const t = k * SRI_STEP + SRI_STEP / 2
    mask[k] = t >= o.b && t < o.w
  }
  return mask
}
export function sleepRegularityIndex(nights) {
  const byDate = new Map((nights || []).map(n => [n.date, n]))
  let agree = 0, total = 0, pairs = 0
  for (const n of nights || []) {
    const next = byDate.get(addDaysStr(n.date, 1))
    if (!next) continue
    const a = asleepMask(n), b = asleepMask(next)
    if (!a || !b) continue
    pairs++
    for (let k = 0; k < SRI_SLOTS; k++) {
      total++
      if (a[k] === b[k]) agree++
    }
  }
  if (pairs < 5) return null
  return { sri: Math.max(0, Math.round(200 * (agree / total) - 100)), pairs }
}

export function sriLabel(sri) {
  if (sri >= 85) return 'Horaires très réguliers'
  if (sri >= 75) return 'Horaires réguliers'
  if (sri >= 60) return 'Horaires assez variables'
  return 'Horaires très variables'
}

// ── Semaine vs jours libres (« jet lag social ») et chronotype ─────────────
// Jours libres = nuits « réveil sans alarme » si au moins 4 nuits de chaque
// côté sont renseignées, sinon week-end (date du réveil samedi/dimanche) vs
// semaine. Milieu de nuit = milieu de la fenêtre endormissement → réveil.
// Retourne null s'il manque des nuits (≥ 3 libres, ≥ 4 autres).
export function socialJetlag(nights) {
  const withT = (nights || []).filter(n => nightOffsets(n))
  let free = withT.filter(n => n.reveil_naturel === true)
  let work = withT.filter(n => n.reveil_naturel === false)
  let basis = 'alarme'
  if (free.length < 4 || work.length < 4) {
    free = withT.filter(n => isWeekendDate(n.date))
    work = withT.filter(n => !isWeekendDate(n.date))
    basis = 'weekend'
  }
  if (free.length < 3 || work.length < 4) return null
  const mid = (list) => mean(list.map(n => nightOffsets(n).mid))
  const dur = (list) => mean(list.map(n => n.duree_min))
  const freeMid = mid(free), workMid = mid(work)
  return {
    basis,
    freeMid, workMid,
    diffMin: freeMid - workMid,
    freeDur: dur(free), workDur: dur(work),
    nFree: free.length, nWork: work.length,
  }
}

// Offset « depuis midi la veille » → heure d'horloge 'HH:MM'.
export function offsetToTime(offset) {
  return minToTime(offset + 720)
}

// Chronotype façon MCTQ (Roenneberg) : milieu de nuit des jours libres,
// corrigé du rattrapage de sommeil quand on dort plus les jours libres.
// Repères (heure d'horloge) : avant 3:30 → du matin, après 5:00 → du soir.
export function chronotype(jetlag) {
  if (!jetlag) return null
  const sdWeek = (5 * jetlag.workDur + 2 * jetlag.freeDur) / 7
  const msfsc = jetlag.freeDur > jetlag.workDur
    ? jetlag.freeMid - (jetlag.freeDur - sdWeek) / 2
    : jetlag.freeMid
  // offsets : 3:30 → 930, 5:00 → 1020
  const key = msfsc < 930 ? 'matin' : msfsc <= 1020 ? 'intermediaire' : 'soir'
  const label = { matin: 'Plutôt du matin', intermediaire: 'Ni du matin ni du soir', soir: 'Plutôt du soir' }[key]
  return { key, label, mid: offsetToTime(msfsc) }
}

// ── Objectif personnalisé ──────────────────────────────────────────────────
// Médiane des nuits « réveil sans alarme » ET qualité ≥ 4 des 60 derniers
// jours, arrondie au quart d'heure, bornée à [7 h, 9 h]. null si moins de 6
// nuits de ce type. Suggestion seulement, jamais appliquée d'office.
export function suggestSleepGoal(nights, todayDateStr) {
  const from = addDaysStr(todayDateStr, -60)
  const good = (nights || []).filter(n =>
    n.date >= from && n.date <= todayDateStr && n.reveil_naturel === true && Number(n.qualite) >= 4,
  )
  if (good.length < 6) return null
  const m = Math.round(median(good.map(n => n.duree_min)) / 15) * 15
  return { minutes: Math.min(540, Math.max(420, m)), n: good.length }
}

// ── Stats d'une période (onglet Sommeil de l'Historique) ───────────────────
export function sleepPeriodStats(nights) {
  const list = nights || []
  if (!list.length) return null
  const durs = list.map(n => n.duree_min)
  const quals = list.map(n => Number(n.qualite)).filter(q => q >= 1 && q <= 5)
  const effs = list.map(sleepEfficiency).filter(e => e != null)
  return {
    n: list.length,
    meanDur: mean(durs),
    nShort: durs.filter(d => d < 360).length,
    meanQual: quals.length ? mean(quals) : null,
    bed: circularStats(list.map(n => timeToMin(n.heure_endormissement))),
    wake: circularStats(list.map(n => timeToMin(n.heure_reveil))),
    efficiency: effs.length ? mean(effs) : null,
  }
}

// Durée moyenne par jour de la semaine du RÉVEIL (index 0 = lundi).
export function durationByWeekday(nights) {
  const sum = Array(7).fill(0), count = Array(7).fill(0)
  for (const n of nights || []) {
    const i = (new Date(n.date + 'T12:00:00').getDay() + 6) % 7
    sum[i] += n.duree_min
    count[i]++
  }
  return sum.map((s, i) => (count[i] ? s / count[i] : null))
}

// ── Nuit courte ────────────────────────────────────────────────────────────
// Deux définitions, chacune à sa place :
//   • isShortNight (calendrier, transit) : repère simple et stable, au moins
//     1 h sous l'objectif ;
//   • isShortVsHabit (conseil du jour, Palier 5) : au moins 1 h sous la durée
//     habituelle du même type de jour, ou moins de 6 h dans tous les cas.
// Les croisements de l'Historique (sleepInsights.js) ont leur propre seuil
// relatif à l'habitude de la strate (settings.sommeil.seuil_nuit_courte_min).
export function isShortNight(night, objectifMin) {
  return !!night && night.duree_min <= objectifMin - 60
}
export function isShortVsHabit(night, usualDureeMin) {
  if (!night) return false
  if (night.duree_min < 360) return true
  return usualDureeMin != null && night.duree_min <= usualDureeMin - 60
}

// ── Heure d'endormissement conseillée (Palier 5) ───────────────────────────
// Réveil habituel du LENDEMAIN (même type de jour) − objectif. `nights` doit
// inclure la nuit du jour si elle est notée. null sans réveil habituel connu.
export const SLEEP_LATENCY_MIN = 15 // temps moyen pour s'endormir une fois au lit
export function bedtimeAdvice(nights, dateStr, objectifMin) {
  const tomorrow = addDaysStr(dateStr, 1)
  const u = usualTimes(nights, tomorrow)
  if (!u?.heure_reveil) return null
  const wake = timeToMin(u.heure_reveil)
  return {
    reveil: u.heure_reveil,
    endormissement: minToTime(wake - objectifMin),
    coucher: minToTime(wake - objectifMin - SLEEP_LATENCY_MIN),
  }
}

// ── « Je vais dormir » / « Je suis réveillée » (Palier 6) ──────────────────
// Le coucher est mémorisé sur l'appareil (localStorage) : la ligne `sommeil`
// ne peut exister qu'une fois la durée connue. `date` = date du réveil visé
// (lendemain si on se couche après midi, jour même sinon).
const PENDING_KEY = 'sleep-bedtime-pending'
export function getPendingBedtime() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY))
    if (!p?.at || !p?.date) return null
    // Oubliée depuis plus de 20 h : on l'ignore.
    if (Date.now() - new Date(p.at).getTime() > 20 * 3600 * 1000) return null
    return p
  } catch { return null }
}
export function setPendingBedtime(now = new Date()) {
  const date = now.getHours() >= 12
    ? fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12))
    : fmt(now)
  const p = { at: now.toISOString(), date }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)) } catch { /* ignore */ }
  return p
}
export function clearPendingBedtime() {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
}
// Coucher mémorisé → pré-remplissage de la feuille : endormissement = coucher
// + latence, réveil = maintenant (arrondis à 5 min).
export function prefillFromPending(p, now = new Date()) {
  const at = new Date(p.at)
  const round5 = (m) => Math.round(m / 5) * 5
  return {
    heure_endormissement: minToTime(round5(at.getHours() * 60 + at.getMinutes() + SLEEP_LATENCY_MIN)),
    heure_reveil: minToTime(round5(now.getHours() * 60 + now.getMinutes())),
  }
}
export function formatClock(iso) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
