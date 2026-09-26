// ─────────────────────────────────────────────────────────────────────────────
// fodmap.js — calcul de la charge en FODMAP d'un aliment à une quantité donnée
// (chantier FODMAP, voir docs/fodmap.md §3 et §5). Fonctions pures.
//
// Quatre groupes, chacun comparé à son seuil « par portion » (Monash, Varney
// et al. 2017) :
//   oligo     fructanes + GOS         0,30 g céréales/légumineuses/noix, 0,20 g sinon
//   fructose  fructose en excès       0,15 g (0,40 g si c'est le seul FODMAP)
//   polyols   sorbitol + mannitol     0,40 g (0,20 g si un seul des deux)
//   lactose                           1,0 g
// Couleur : ≤ seuil = faible, ≤ 2× seuil = modéré, au-delà = élevé.
//
// Sources des valeurs /100 g, par priorité : fodmapData.js (table curatée) >
// colonnes Ciqual (fructose, glucose, lactose, polyols) > famille d'aliments
// où le groupe est biologiquement absent > mots-clés du nom (qualitatif) >
// inconnu. Un groupe inconnu n'est JAMAIS affiché « faible ».
// ─────────────────────────────────────────────────────────────────────────────
import { getCuratedFodmap } from './fodmapData'
import { getCategoryLabel } from './ciqualExplorer'

// ── Réglages (settings.fodmap) ──────────────────────────────────────────────
export const FODMAP_DEFAULTS = { enabled: false }

export function mergeFodmapSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return { ...FODMAP_DEFAULTS, ...s }
}

// ── Groupes ─────────────────────────────────────────────────────────────────
export const FODMAP_GROUPS = [
  { key: 'oligo', label: 'Fructanes et GOS', hint: 'blé, seigle, oignon, ail, légumineuses' },
  { key: 'fructose', label: 'Fructose en excès', hint: 'pomme, poire, miel, mangue' },
  { key: 'polyols', label: 'Polyols', hint: 'sorbitol, mannitol' },
  { key: 'lactose', label: 'Lactose', hint: 'lait, yaourt, fromage frais' },
]

export const LACTOSE_THRESHOLD = 1.0
export const FRUCTOSE_THRESHOLD = 0.15
export const FRUCTOSE_ONLY_THRESHOLD = 0.4
export const POLYOLS_THRESHOLD = 0.4
export const SINGLE_POLYOL_THRESHOLD = 0.2
export const OLIGO_THRESHOLD = 0.2
export const OLIGO_GRAIN_THRESHOLD = 0.3

// ── Familles d'aliments ─────────────────────────────────────────────────────
const VEGETAUX = 'Fruits, légumes, légumineuses et oléagineux'
const CEREALES = 'Produits céréaliers'
// Familles sans fructanes, GOS ni polyols (le lactose reste lu dans Ciqual).
const NO_PLANT_CARBS = new Set(['Viandes, œufs et poissons', 'Produits laitiers', 'Matières grasses'])
// Familles sans lactose quand Ciqual ne le renseigne pas.
const NO_LACTOSE = new Set([VEGETAUX, 'Viandes, œufs et poissons'])

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Céréales, légumineuses, noix, graines : seuil oligosaccharides 0,30 g.
const GRAIN_LEGUME_NUT_RE = /(pois chiche|lentille|haricot|feve|flageolet|pois casse|soja|noix|amande|noisette|cajou|pistache|cacahuete|arachide|graine|sesame|chia|\blin\b|quinoa|avoine|\briz\b|\bble\b|froment|seigle|orge|epeautre|sarrasin|millet|\bpain|pates|farine|semoule|couscous|cereale|galette de riz)/

// Mots-clés qualitatifs (« probablement riche ») : seulement quand le groupe
// n'a pas de valeur chiffrée. Volontairement limité aux sources majeures.
const KEYWORD_RULES = [
  { group: 'oligo', part: 'fructanes', re: /\b(ail|oignons?|echalotes?|poireaux?|artichauts?|topinambours?|inuline|chicoree|dattes?|figues?)\b/ },
  { group: 'oligo', part: 'fructanes', re: /(seigle|froment|\bble\b|\bpain|pates|semoule|couscous|biscotte|brioche|croissant|pizza|epeautre|\borge\b)/, unless: /sans gluten/ },
  { group: 'oligo', part: 'GOS', re: /(pois chiche|lentille|haricot(?! vert)|\bfeve|flageolet|pois casse|houmous|cajou|pistache|graine de soja)/ },
  { group: 'polyols', part: 'sorbitol', re: /(\bpommes?\b(?! de terre)|\bpoires?\b|pruneau|\bprunes?\b|cerise|\bpeches?\b|nectarine|abricot|\bmures?\b|avocat|sans sucres|sorbitol|maltitol|xylitol|isomalt)/ },
  { group: 'polyols', part: 'mannitol', re: /(champignon|chou-fleur|celeri|pasteque)/ },
  { group: 'fructose', part: null, re: /(\bmiel\b|agave|mangue|pasteque|sirop de glucose-fructose)/ },
]

// ── Liste d'ingrédients (produits Open Food Facts, Palier 5) ────────────────
// Repère dans la liste d'ingrédients d'un produit les sources de FODMAP.
// Qualitatif : la liste ne donne presque jamais de quantités. Un ingrédient
// compte comme « principal » s'il est parmi les 3 premiers (la liste est
// triée par quantité décroissante) ou annoncé à 5 % ou plus ; les additifs
// polyols et l'inuline comptent toujours (ajoutés pour leur effet, à dose
// notable). Seuls les ingrédients principaux font passer une famille non
// chiffrée en « probablement élevé ».
const INGREDIENT_RULES = [
  { group: 'polyols', label: 'polyols (édulcorants)', always: true, re: /\b(e ?420|e ?421|e ?953|e ?965|e ?966|e ?967|sorbitol|mannitol|isomalt|maltitol|lactitol|xylitol)\b/ },
  { group: 'oligo', label: 'inuline / FOS', always: true, re: /(inuline|fructo-?oligosaccharide|oligofructose|\bfos\b|fibres? de chicoree|racine de chicoree)/ },
  { group: 'oligo', label: 'ail ou oignon', re: /\b(ail|oignons?|echalotes?)\b/ },
  { group: 'oligo', label: 'blé, seigle ou orge', re: /(\bble\b|froment|seigle|\borge\b|epeautre)/, strip: /(amidon[^,]*|sirop de glucose[^,]*|dextrose[^,]*|maltodextrine[^,]*|gluten[^,]*|proteines? de ble[^,]*|malt d'orge[^,]*|extrait de malt[^,]*)/g },
  { group: 'oligo', label: 'légumineuses', re: /(pois chiches?|lentilles?|haricots?(?! verts)|\bfeves?\b|farine de pois|farine de soja|graines? de soja)/ },
  { group: 'lactose', label: 'lait ou lactose', re: /(\blait\b|lactose|lactoserum|petit-lait|poudre de lait|\bcreme\b|fromage blanc|fromage frais|yaourt|babeurre)/, strip: /(sans lactose|lait de coco|lait d'amande|lait d'avoine|lait de riz|lait de soja|creme de coco|beurre de cacao|proteines? de lait|proteines? laitieres)/g },
  { group: 'fructose', label: 'fructose, miel ou agave', re: /(fructose|sirop d'agave|\bagave\b|\bmiel\b|jus de pomme|jus de poire|concentre de pomme|concentre de poire)/ },
]

// Découpe au premier niveau (les sous-ingrédients entre parenthèses restent
// attachés à leur ingrédient) et s'arrête aux mentions de traces.
function splitIngredients(text) {
  // OFF marque les allergènes par des _soulignés_ ; apostrophes typographiques unifiées.
  const t = normalize(text).replace(/_/g, ' ').replace(/[’`]/g, "'").split(/(peut contenir|traces? (eventuelles|possibles|de))/)[0]
  const out = []
  let depth = 0, cur = ''
  for (const ch of t) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && depth === 0) { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

export function analyzeIngredients(text, additivesTags = []) {
  if (!text && !additivesTags?.length) return []
  const parts = splitIngredients(text || '')
  const hits = new Map() // label -> { label, group, main }
  const add = (rule, main) => {
    const prev = hits.get(rule.label)
    hits.set(rule.label, { label: rule.label, group: rule.group, main: !!(main || prev?.main) })
  }
  parts.forEach((seg, i) => {
    const pct = seg.match(/(\d+(?:[.,]\d+)?)\s*%/)
    const main = i < 3 || (pct && parseFloat(pct[1].replace(',', '.')) >= 5)
    for (const rule of INGREDIENT_RULES) {
      const clean = rule.strip ? seg.replace(rule.strip, ' ') : seg
      if (rule.re.test(clean)) add(rule, rule.always || main)
    }
  })
  const tags = (additivesTags || []).map(t => String(t).replace(/^[a-z]{2}:/, '')).join(' ')
  if (tags) {
    const polyols = INGREDIENT_RULES[0]
    if (polyols.re.test(tags)) add(polyols, true)
  }
  return [...hits.values()]
}

// ── Profil /100 g ───────────────────────────────────────────────────────────
// `food` : objet aliment tel que manipulé par FoodPicker / l'explorateur
// (alim_nom, categorie, alim_code, _source, colonnes nutriments /100 g).
// `ciqualRow` : ligne Ciqual fraîche (colonnes sucres/polyols à jour) quand
// l'aliment vient de Ciqual — prioritaire sur les valeurs portées par `food`,
// qui peuvent venir d'une entrée de journal figée avant la correction des
// données Ciqual du 2026-09-26.
//
// `override` : réglage de l'utilisatrice pour un aliment perso
// (aliments_custom.fodmap, voir FODMAP_OVERRIDE_VALUES) — par défaut lu sur
// `food.fodmap`. Prioritaire sur tout le reste pour les familles renseignées.
export const FODMAP_OVERRIDE_VALUES = ['absent', 'present']

export function buildFodmapProfile(food, ciqualRow = null, override = undefined) {
  if (!food) return null
  const src = { ...food, ...(ciqualRow || {}) }
  const isCiqual = (food._source || 'ciqual') === 'ciqual' && src.alim_code != null
  const curated = isCiqual ? getCuratedFodmap(src.alim_code) : null
  const family = getCategoryLabel(src.categorie)
  const name = normalize(src.alim_nom || src.food_name)
  const noPlantCarbs = NO_PLANT_CARBS.has(family)
  const num = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x))
  const pick = (key) => (curated && curated[key] !== undefined ? curated[key] : undefined)

  // Valeur d'un sous-groupe de fodmapData ({value, confidence}), ou absence
  // biologique déduite de la famille, ou undefined (inconnu).
  const part = (key) => {
    const c = pick(key)
    if (c !== undefined) return c
    if (noPlantCarbs) return { value: 0, confidence: 'absent' }
    return undefined
  }

  const keywordHits = {}
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(name) && !(rule.unless && rule.unless.test(name))) {
      ;(keywordHits[rule.group] ||= new Set()).add(rule.part)
    }
  }
  // Produit Open Food Facts : ingrédients principaux repérés dans la liste.
  const ingredientHits = food._ingredientsText || food._additives?.length
    ? analyzeIngredients(food._ingredientsText, food._additives)
    : []
  for (const h of ingredientHits) {
    if (h.main) (keywordHits[h.group] ||= new Set()).add(h.label)
  }

  const groups = {}

  // Oligosaccharides : fructanes + GOS.
  {
    const fr = part('fructans'), go = part('gos')
    const parts = [['fructanes', fr], ['GOS', go]].filter(([, p]) => p !== undefined)
    groups.oligo = {
      value: parts.length ? parts.reduce((s, [, p]) => s + (p.value || 0), 0) : null,
      complete: parts.length === 2,
      parts: parts.map(([label, p]) => ({ label, value: p.value, confidence: p.confidence })),
      confidence: worstConfidence(parts.map(([, p]) => p.confidence)),
    }
  }

  // Fructose en excès, aliment par aliment.
  {
    const fru = num(pick('fructose') ?? src.fructose)
    const glu = num(pick('glucose') ?? src.glucose)
    const overridden = pick('fructose') !== undefined
    let value = null
    if (fru != null && glu != null) value = Math.max(0, fru - glu)
    else if (fru === 0) value = 0
    else if (noPlantCarbs && fru == null) value = 0
    groups.fructose = {
      value, complete: value != null, parts: [],
      confidence: value == null ? null : overridden ? (fru === 0 && glu === 0 ? 'absent' : 'measured') : isCiqual ? 'ciqual' : 'label',
    }
  }

  // Polyols : sorbitol + mannitol curatés, sinon total Ciqual.
  {
    const so = part('sorbitol'), ma = part('mannitol')
    const curatedParts = [['sorbitol', so], ['mannitol', ma]].filter(([, p]) => p !== undefined)
    let g
    if (curatedParts.length) {
      g = {
        value: curatedParts.reduce((s, [, p]) => s + (p.value || 0), 0),
        complete: curatedParts.length === 2,
        parts: curatedParts.map(([label, p]) => ({ label, value: p.value, confidence: p.confidence })),
        confidence: worstConfidence(curatedParts.map(([, p]) => p.confidence)),
      }
      // Un seul polyol présent → seuil plus bas (0,2 g).
      const present = curatedParts.filter(([, p]) => (p.value || 0) > 0)
      g.single = g.complete && present.length === 1
    } else {
      const total = curated?.ignoreCiqualPolyols ? null : num(src.polyols)
      if (total == null) g = { value: null, complete: false, parts: [], confidence: null }
      else if (total === 0 && family === VEGETAUX) {
        // « < 0,5 g/100 g » chez l'ANSES, ramené à 0 : trop grossier pour un
        // fruit ou un légume (seuil 0,2 g par portion) → borne basse.
        g = { value: 0, complete: false, parts: [], confidence: 'ciqual' }
      } else g = { value: total, complete: true, parts: [], confidence: isCiqual ? 'ciqual' : 'label' }
      g.single = false
    }
    groups.polyols = g
  }

  // Lactose.
  {
    const lac = num(pick('lactose') ?? src.lactose)
    let value = lac
    if (value == null && NO_LACTOSE.has(family)) value = 0
    groups.lactose = {
      value, complete: value != null, parts: [],
      confidence: value == null ? null : pick('lactose') !== undefined ? (value === 0 ? 'absent' : 'estimated') : lac == null ? 'absent' : isCiqual ? 'ciqual' : 'label',
    }
  }

  for (const [key, g] of Object.entries(groups)) {
    g.keyword = !g.complete && keywordHits[key] ? [...keywordHits[key]].filter(Boolean) : null
    if (g.keyword && !g.keyword.length) g.keyword = [key]
  }

  // Réglage de l'utilisatrice (aliment perso) : « absent » = teneur nulle
  // connue, « présent » = probablement élevé, quantité non mesurée.
  const ov = override !== undefined ? override : (food._source === 'custom' ? food.fodmap : null)
  if (ov && typeof ov === 'object') {
    for (const key of Object.keys(groups)) {
      if (ov[key] === 'absent') {
        groups[key] = { ...groups[key], value: 0, complete: true, parts: [], confidence: 'user', keyword: null, single: false }
      } else if (ov[key] === 'present') {
        groups[key] = { ...groups[key], value: null, complete: false, parts: [], confidence: 'user', keyword: ['selon ta fiche'], single: false }
      }
    }
  }

  // Seuils propres à l'aliment.
  const oligoThreshold = family === CEREALES || GRAIN_LEGUME_NUT_RE.test(name)
    ? OLIGO_GRAIN_THRESHOLD : OLIGO_THRESHOLD
  const othersZero = ['oligo', 'polyols', 'lactose'].every(k => groups[k].complete && groups[k].value === 0)
  groups.oligo.threshold = oligoThreshold
  groups.fructose.threshold = othersZero ? FRUCTOSE_ONLY_THRESHOLD : FRUCTOSE_THRESHOLD
  groups.polyols.threshold = groups.polyols.single ? SINGLE_POLYOL_THRESHOLD : POLYOLS_THRESHOLD
  groups.lactose.threshold = LACTOSE_THRESHOLD

  return {
    groups,
    note: curated?.note || null,
    curated: !!curated,
    ingredientHits,
  }
}

const CONFIDENCE_RANK = { absent: 0, user: 0, measured: 1, ciqual: 1, label: 2, derived: 3, estimated: 4 }
function worstConfidence(list) {
  const known = list.filter(Boolean)
  if (!known.length) return null
  return known.reduce((a, b) => ((CONFIDENCE_RANK[b] ?? 5) > (CONFIDENCE_RANK[a] ?? 5) ? b : a))
}

// ── Évaluation à une quantité ───────────────────────────────────────────────
// Niveaux, du plus rassurant au plus chargé :
//   low          faible (données complètes)
//   likely-low   probablement faible (données incomplètes, borne basse sous le seuil)
//   unknown      données manquantes
//   likely-high  probablement élevé (d'après le nom de l'aliment)
//   moderate     modéré (≤ 2× le seuil)
//   high         élevé
export const LEVEL_RANK = { low: 0, 'likely-low': 1, unknown: 2, 'likely-high': 3, moderate: 4, high: 5 }

export function evaluateFodmap(profile, qtyG) {
  if (!profile) return null
  const q = Math.max(0, Number(qtyG) || 0) / 100
  const rows = FODMAP_GROUPS.map(({ key, label, hint }) => {
    const g = profile.groups[key]
    const amount = g.value != null ? g.value * q : null
    let level
    if (amount == null) level = g.keyword ? 'likely-high' : 'unknown'
    else if (amount > 2 * g.threshold) level = 'high'
    else if (amount > g.threshold) level = 'moderate'
    else if (g.complete) level = 'low'
    else level = g.keyword ? 'likely-high' : 'likely-low'
    return {
      key, label, hint, level, amount,
      threshold: g.threshold,
      complete: g.complete,
      confidence: g.confidence,
      keyword: g.keyword,
      parts: g.parts.map(p => ({ ...p, amount: p.value != null ? p.value * q : null })),
    }
  })
  const overall = rows.reduce((w, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[w] ? r.level : w), 'low')
  return { rows, overall }
}

// ── Portion sûre ────────────────────────────────────────────────────────────
// Plus grande quantité qui reste sous tous les seuils connus. `partial` = au
// moins un groupe n'est pas entièrement connu (la limite réelle peut être
// plus basse). grams = Infinity : aucun FODMAP dans les données connues.
export function safePortion(profile) {
  if (!profile) return null
  let best = { grams: Infinity, groupKey: null }
  let partial = false
  for (const { key } of FODMAP_GROUPS) {
    const g = profile.groups[key]
    if (!g.complete) partial = true
    if (g.value != null && g.value > 0) {
      const grams = (g.threshold / g.value) * 100
      if (grams < best.grams) best = { grams, groupKey: key }
    }
  }
  return { ...best, partial }
}

// Arrondi lisible pour une portion en grammes.
export function roundPortion(g) {
  if (!Number.isFinite(g)) return g
  if (g < 20) return Math.max(1, Math.round(g))
  if (g < 100) return Math.round(g / 5) * 5
  return Math.round(g / 10) * 10
}

export function formatGrams(x) {
  if (x == null) return '—'
  if (x === 0) return '0 g'
  if (x < 0.01) return '< 0,01 g'
  return `${x.toFixed(x < 1 ? 2 : 1).replace('.', ',')} g`
}

// ── Cumul d'un repas (Palier 2) ─────────────────────────────────────────────
// Les FODMAP de plusieurs aliments mangés ensemble s'additionnent : trois
// aliments « faibles » peuvent faire un repas « modéré ». Il n'existe pas de
// seuil officiel par repas ; on additionne, famille par famille, la part de
// son seuil que chaque aliment consomme (quantité ÷ seuil propre à
// l'aliment). Un repas d'un seul aliment retombe exactement sur la pastille de
// cet aliment ; une charge cumulée > 1 = au-dessus du seuil, > 2 = élevée.
//
// `items` : [{ id, name, profile, qtyG }] ; `profile` null = aliment non
// évaluable (recette, dont le calcul par ingrédient n'existe pas encore) →
// compté dans `skipped`.
export function evaluateMeal(items) {
  const evaluated = []
  let skipped = 0
  for (const it of items) {
    if (!it.profile) { skipped++; continue }
    evaluated.push({ ...it, ev: evaluateFodmap(it.profile, it.qtyG) })
  }
  if (!evaluated.length) return { rows: [], overall: null, stacked: false, skipped, byId: {} }

  const rows = FODMAP_GROUPS.map(({ key, label }) => {
    let load = 0
    let anyKnown = false
    let complete = true
    let keyword = false
    let singleOver = false
    const contributors = []
    for (const it of evaluated) {
      const r = it.ev.rows.find(x => x.key === key)
      if (r.amount != null) {
        anyKnown = true
        const share = r.threshold > 0 ? r.amount / r.threshold : 0
        load += share
        if (share > 1) singleOver = true
        if (r.amount > 0) contributors.push({ id: it.id, name: it.name, share })
      }
      if (!r.complete) complete = false
      if (r.keyword) {
        keyword = true
        if (r.amount == null) contributors.push({ id: it.id, name: it.name, share: null })
      }
    }
    let level
    if (load > 2) level = 'high'
    else if (load > 1) level = 'moderate'
    else if (keyword) level = 'likely-high'
    else if (!anyKnown) level = 'unknown'
    else level = complete ? 'low' : 'likely-low'
    contributors.sort((a, b) => (b.share ?? Infinity) - (a.share ?? Infinity))
    // « Cumul » : le repas dépasse le seuil alors qu'aucun aliment ne le
    // dépasse seul.
    const stacked = (level === 'moderate' || level === 'high') && !singleOver
    return { key, label, level, load, complete, contributors, stacked }
  })

  const overall = rows.reduce((w, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[w] ? r.level : w), 'low')
  const byId = Object.fromEntries(evaluated.map(it => [it.id, it.ev]))
  return { rows, overall, stacked: rows.some(r => r.stacked), skipped, byId }
}

// ── Recette (Palier 3) ──────────────────────────────────────────────────────
// Une portion de recette = un « repas » de ses ingrédients : chaque
// ingrédient pèse sa quantité crue × (portion ÷ poids de référence de la
// recette), et evaluateMeal fait le cumul. Portion sûre : les charges sont
// proportionnelles à la portion, on les calcule donc pour 100 g et on en
// déduit le grammage où la famille la plus chargée atteint son seuil.
export function mealSafePortion(evalAt100g) {
  if (!evalAt100g?.overall) return null
  let best = { grams: Infinity, groupKey: null }
  let partial = false
  for (const r of evalAt100g.rows) {
    if (!r.complete) partial = true
    if (r.load > 0) {
      const grams = 100 / r.load
      if (grams < best.grams) best = { grams, groupKey: r.key }
    }
  }
  return { ...best, partial }
}

// Alternatives couramment citées pour les ingrédients riches en FODMAP
// (Monash, listes diététiques publiques). Information, pas prescription :
// affichées seulement pour les ingrédients qui pèsent dans une famille
// modérée ou élevée.
const SUBSTITUTIONS = [
  { re: /\bail\b/, text: 'huile infusée à l’ail (les fructanes ne passent pas dans l’huile), ciboulette' },
  { re: /\b(oignons?|echalotes?)\b/, text: 'vert de ciboule ou d’oignon nouveau, ciboulette' },
  { re: /\bpoireaux?\b/, text: 'vert de poireau (le blanc en contient davantage)' },
  { re: /(pois chiche|lentille)/, text: 'en conserve, égouttés et rincés : une partie des GOS reste dans le jus' },
  { re: /\blait\b/, unless: /sans lactose/, text: 'lait sans lactose ou boisson d’amande' },
  { re: /(yaourt|fromage blanc|petit-suisse|creme fraiche|skyr|ricotta)/, unless: /sans lactose/, text: 'version sans lactose' },
  { re: /(\bpain|\bpates\b|farine|semoule|couscous)/, unless: /(sans gluten|epeautre|riz|mais|sarrasin)/, text: 'pain au levain d’épeautre, pâtes ou farine sans gluten' },
  { re: /(\bmiel\b|agave)/, text: 'sirop d’érable' },
  { re: /champignon/, text: 'pleurotes, champignons de Paris en conserve égouttés' },
  { re: /chou-fleur/, text: 'têtes de brocoli' },
  { re: /(cajou|pistache)/, text: 'noix de macadamia, noix de pécan, cacahuètes' },
  { re: /(\bpommes?\b(?! de terre)|\bpoires?\b|mangue)/, text: 'orange, kiwi, fraises' },
]

export function fodmapSubstitution(name) {
  const n = normalize(name)
  const s = SUBSTITUTIONS.find(x => x.re.test(n) && !(x.unless && x.unless.test(n)))
  return s ? s.text : null
}

// ── Explorateur (Palier 3) ──────────────────────────────────────────────────
// Profil mémorisé par objet aliment : le catalogue de l'explorateur (3 500
// lignes, objets stables pour la session) est refiltré à chaque frappe.
const profileMemo = new WeakMap()
export function memoFodmapProfile(food) {
  if (!food) return null
  let p = profileMemo.get(food)
  if (!p) { p = buildFodmapProfile(food); profileMemo.set(food, p) }
  return p
}

export const FODMAP_FILTERS = [
  { key: 'all', label: 'Faibles en FODMAP' },
  { key: 'oligo', label: 'Fructanes et GOS faibles' },
  { key: 'fructose', label: 'Fructose faible' },
  { key: 'polyols', label: 'Polyols faibles' },
  { key: 'lactose', label: 'Lactose faible' },
]

const LOWISH = new Set(['low', 'likely-low'])

// `keys` : clés de FODMAP_FILTERS (ET logique). L'aliment passe si, à la
// quantité donnée, chaque famille demandée est faible ou probablement faible
// (« all » = toutes les familles). Une famille inconnue ne passe jamais.
export function passesFodmapFilter(food, qtyG, keys) {
  if (!keys?.length) return true
  const ev = evaluateFodmap(memoFodmapProfile(food), qtyG)
  if (!ev) return false
  return keys.every(k => (k === 'all'
    ? LOWISH.has(ev.overall)
    : LOWISH.has(ev.rows.find(r => r.key === k)?.level)))
}

// ── Liste de courses (Palier 5) ─────────────────────────────────────────────
// Repère d'un article : la quantité achetée n'est pas celle d'un repas, on
// indique donc jusqu'où l'aliment reste faible plutôt qu'un niveau. null =
// rien à signaler (faible jusqu'à au moins 100 g, ou données inconnues).
export function shoppingFodmapHint(profile) {
  if (!profile) return null
  const sp = safePortion(profile)
  if (sp && Number.isFinite(sp.grams) && sp.grams < 100) {
    const g = roundPortion(sp.grams)
    return { kind: 'limit', grams: g, level: g < 5 ? 'high' : 'moderate' }
  }
  const ev = evaluateFodmap(profile, 100)
  if (ev?.overall === 'likely-high') return { kind: 'probable', level: 'likely-high' }
  return null
}
