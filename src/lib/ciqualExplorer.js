// ─────────────────────────────────────────────────────────────────────────────
// Logique pure de l'explorateur Ciqual (src/pages/ExplorerPage.jsx).
//
// Pourquoi tout se fait côté client : les tris utiles ici ne sont pas des tris
// de colonne mais des tris sur valeurs DÉRIVÉES (densité pour 100 kcal, valeur
// par portion réelle, % de la VNR). PostgREST ne sait pas trier sur une
// expression — il aurait fallu une vue avec une colonne générée par nutriment,
// et un aller-retour réseau à chaque changement de réglage. On charge donc une
// fois une projection allégée de `ciqual` (voir useCiqualCatalog) et tout le
// tri/filtre se fait en mémoire, instantanément.
//
// VITAMIN_FIELDS / MINERAL_FIELDS restent la source unique de vérité pour les
// libellés, unités et références (RNP/VNR) — rien n'est redéfini ici.
// ─────────────────────────────────────────────────────────────────────────────

import { VITAMIN_FIELDS, MINERAL_FIELDS, SATURATED_FAT_KEY } from './nutrients'

// ── Macros triables ─────────────────────────────────────────────────────────
// Pas de `ref` : les macros n'ont pas de VNR unique (l'objectif dépend de la
// personne), leurs seuils d'allégation se calculent autrement (voir getClaimLevel).
export const MACRO_FIELDS = [
  { key: 'energie_kcal',    label: 'Calories',   unit: 'kcal' },
  { key: 'proteines',       label: 'Protéines',  unit: 'g' },
  { key: 'glucides',        label: 'Glucides',   unit: 'g' },
  { key: 'lipides',         label: 'Lipides',    unit: 'g' },
  { key: 'fibres',          label: 'Fibres',     unit: 'g' },
  { key: 'sucres',          label: 'Sucres',     unit: 'g' },
  { key: SATURATED_FAT_KEY, label: 'AG saturés', unit: 'g' },
]

// Groupes proposés dans le sélecteur de tri (deux niveaux : groupe → nutriment,
// même principe que FoodSortModal — une liste à plat de 32 nutriments serait
// illisible sur mobile).
export const SORT_GROUPS = [
  { label: 'Macros',    fields: MACRO_FIELDS },
  { label: 'Vitamines', fields: VITAMIN_FIELDS },
  { label: 'Minéraux',  fields: MINERAL_FIELDS },
]

export const ALL_SORT_FIELDS = SORT_GROUPS.flatMap(g => g.fields)

// Projection minimale envoyée à Supabase : uniquement ce dont l'explorateur a
// besoin pour trier, filtrer et afficher. Un `select('*')` tirerait les ~70
// colonnes de `ciqual` (acides gras détaillés, sucres détaillés, détails
// rétinol/D2/D3...) inutiles ici, pour plusieurs Mo transférés en plus.
// Dérivée des listes de champs, jamais recopiée à la main.
export const EXPLORER_SELECT = Array.from(new Set([
  'id', 'alim_code', 'alim_nom', 'categorie', 'portions',
  ...ALL_SORT_FIELDS.flatMap(f => f.sumKeys || [f.key]),
])).join(',')

export function findField(key) {
  return ALL_SORT_FIELDS.find(f => f.key === key) || MACRO_FIELDS[0]
}

// ── Bases de comparaison ────────────────────────────────────────────────────
// C'est le cœur de l'outil. Un classement brut /100 g sur Ciqual remonte des
// épices déshydratées et des ingrédients purs (100 g de thym, de sel, de
// levure) qu'on ne mange jamais tels quels. Deux autres bases rendent le
// classement exploitable :
//   kcal100 — densité nutritionnelle : « le plus de fer par calorie dépensée »
//   portion — valeur réellement apportée par une portion usuelle (colonne
//             `portions` de ciqual), qui remet les épices à leur vraie place.
export const SORT_BASES = [
  { key: 'g100',    label: 'pour 100 g',    short: '/100 g' },
  { key: 'kcal100', label: 'pour 100 kcal', short: '/100 kcal' },
  { key: 'portion', label: 'par portion',   short: '/portion' },
]

// Portion usuelle déclarée sur l'aliment. Tous les aliments Ciqual n'en ont
// pas : on retombe alors sur 100 g, en le disant explicitement dans le libellé
// (mieux qu'exclure l'aliment du classement sans prévenir).
export function getPortion(food) {
  const p = food.portions?.[0]
  if (p?.g > 0) return { g: p.g, label: p.label || `${p.g} g`, declared: true }
  return { g: 100, label: '100 g', declared: false }
}

// Valeur brute /100 g, en préservant la distinction null / 0 : dans Ciqual,
// une case vide veut dire « non mesuré », pas « absent ». Les afficher comme
// des zéros ferait passer des aliments jamais analysés pour des aliments
// pauvres. On ne somme donc que les clés renseignées, et on rend null si
// aucune ne l'est.
export function rawValue(food, field) {
  const keys = field.sumKeys || [field.key]
  let sum = null
  for (const k of keys) {
    const v = food[k]
    if (v == null) continue
    sum = (sum ?? 0) + Number(v)
  }
  return sum
}

export function fieldValue(food, field, base) {
  const raw = rawValue(food, field)
  if (raw == null) return null
  // « Calories pour 100 kcal » ne veut rien dire : on retombe sur la valeur
  // brute plutôt que d'afficher 100 partout.
  if (base === 'kcal100' && field.key !== 'energie_kcal') {
    const kcal = food.energie_kcal
    if (!kcal || kcal <= 0) return null // aliment sans énergie (eau, thé) : densité indéfinie
    return (raw / kcal) * 100
  }
  if (base === 'portion') return (raw * getPortion(food).g) / 100
  return raw
}

// ── Allégations nutritionnelles (règlement UE n°1924/2006, annexe) ───────────
// Seuils officiels, pas des estimations maison :
//   vitamines & minéraux — « source de » ≥ 15 % de la VNR pour 100 g,
//                          « riche en » ≥ 30 %
//   protéines            — « source » ≥ 12 % de l'énergie, « riche » ≥ 20 %
//   fibres               — « source » ≥ 3 g/100 g, « riche » ≥ 6 g/100 g
// Les nutriments `limite` (sel, sodium) sont exclus : il n'existe évidemment
// pas d'allégation « riche en sel » à valoriser.
export const CLAIM_MICRO_FIELDS = [...VITAMIN_FIELDS, ...MINERAL_FIELDS].filter(f => !f.limite)

const PROT_FIELD   = MACRO_FIELDS.find(f => f.key === 'proteines')
const FIBRES_FIELD = MACRO_FIELDS.find(f => f.key === 'fibres')

export const CLAIM_GROUPS = [
  { label: 'Macros',    fields: [PROT_FIELD, FIBRES_FIELD] },
  { label: 'Vitamines', fields: VITAMIN_FIELDS },
  { label: 'Minéraux',  fields: MINERAL_FIELDS.filter(f => !f.limite) },
]

// 'riche' | 'source' | null — pour UN nutriment donné, sur les valeurs /100 g.
export function getClaimLevel(food, field) {
  if (field.key === 'proteines') {
    const kcal = food.energie_kcal
    if (!kcal || kcal <= 0) return null
    const share = ((food.proteines || 0) * 4) / kcal
    return share >= 0.20 ? 'riche' : share >= 0.12 ? 'source' : null
  }
  if (field.key === 'fibres') {
    const v = food.fibres
    if (v == null) return null
    return v >= 6 ? 'riche' : v >= 3 ? 'source' : null
  }
  if (!field.ref || field.limite) return null
  const v = rawValue(food, field)
  if (v == null) return null
  const pct = v / field.ref
  return pct >= 0.30 ? 'riche' : pct >= 0.15 ? 'source' : null
}

// Allégations « riche en » d'un aliment, dans l'ordre macros puis micros — sert
// aux pastilles de la liste. On ne remonte que les « riche en » : afficher
// aussi les « source de » noierait la carte sous huit pastilles.
export function getRichClaims(food, max = 3) {
  const out = []
  for (const field of [PROT_FIELD, FIBRES_FIELD, ...CLAIM_MICRO_FIELDS]) {
    if (getClaimLevel(food, field) === 'riche') out.push(field)
    if (out.length >= max) break
  }
  return out
}

// ── Catégories ──────────────────────────────────────────────────────────────
const normalize = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Les épices, herbes séchées et aides culinaires faussent tous les classements
// (100 g de thym séché = plusieurs fois la VNR en fer). On les masque par
// défaut, avec un interrupteur pour les réafficher. Détection sur le libellé
// plutôt que sur une liste figée : le nommage exact des catégories dépend de
// l'import Ciqual en base, et une catégorie non reconnue ne masque rien.
// Radicaux volontairement courts : les libellés Ciqual sont au pluriel
// (« Aides culinaires et ingrédients divers »), un mot-clé au singulier ne
// matcherait rien.
const SEASONING_HINTS = ['culinaire', 'ingredient', 'epice', 'herbe', 'condiment']

export function isSeasoningCategory(categorie) {
  const c = normalize(categorie)
  return SEASONING_HINTS.some(h => c.includes(h))
}

// Liste des catégories réellement présentes en base — construite depuis le
// catalogue chargé, jamais codée en dur (voir remarque ci-dessus).
export function listCategories(foods) {
  return Array.from(new Set(foods.map(f => f.categorie).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

// ── Filtre + tri ────────────────────────────────────────────────────────────
export const DEFAULT_FILTERS = {
  query: '',
  categories: [],
  claims: [],          // clés de nutriments dont on veut « riche en »
  favoritesOnly: false,
  fitsRemainingKcal: false,
  showSeasonings: false,
}

export const DEFAULT_SORT = { field: 'proteines', dir: 'desc', base: 'g100' }

export function filterFoods(foods, filters, { isFavorite, remainingKcal } = {}) {
  const q = normalize(filters.query).trim()
  const claimFields = filters.claims.map(findField)

  return foods.filter(food => {
    if (!filters.showSeasonings && isSeasoningCategory(food.categorie)) return false
    if (q && !normalize(food.alim_nom).includes(q)) return false
    if (filters.categories.length && !filters.categories.includes(food.categorie)) return false
    // Plusieurs pastilles « riche en » = ET logique : on cherche l'aliment qui
    // coche tous les besoins à la fois, pas l'union des trois listes.
    if (claimFields.length && !claimFields.every(f => getClaimLevel(food, f) === 'riche')) return false
    if (filters.favoritesOnly && !isFavorite?.(food)) return false
    if (filters.fitsRemainingKcal && remainingKcal != null) {
      const kcalPortion = ((food.energie_kcal || 0) * getPortion(food).g) / 100
      if (kcalPortion > remainingKcal) return false
    }
    return true
  })
}

// Les valeurs manquantes finissent TOUJOURS en fin de liste, quel que soit le
// sens du tri. (En SQL, `order by ... desc` remonte les NULL en premier : la
// première page serait pleine d'aliments sans donnée. Même piège en JS si on
// traite null comme 0.)
export function sortFoods(foods, { field, dir, base }) {
  const f = findField(field)
  const mult = dir === 'asc' ? 1 : -1
  return [...foods]
    .map(food => ({ food, val: fieldValue(food, f, base) }))
    .sort((a, b) => {
      if (a.val == null && b.val == null) return a.food.alim_nom.localeCompare(b.food.alim_nom, 'fr')
      if (a.val == null) return 1
      if (b.val == null) return -1
      if (a.val !== b.val) return mult * (a.val - b.val)
      return a.food.alim_nom.localeCompare(b.food.alim_nom, 'fr')
    })
    .map(x => x.food)
}

// ── Manques du jour ─────────────────────────────────────────────────────────
// Classe les nutriments par écart à l'objectif, du plus déficitaire au moins.
// `totals` = sortie de computeTotals() (clés prot/fib pour les macros, clé
// nutriment pour les micros). Les nutriments `limite` (sel, sodium) sont
// exclus : en manquer n'est pas un problème.
export function getNutrientGaps(totals, settings, limit = 3) {
  if (!totals) return []
  const items = []

  if (settings?.goal_proteines > 0) {
    items.push({ field: PROT_FIELD, pct: (totals.prot || 0) / settings.goal_proteines })
  }
  if (settings?.goal_fibres > 0) {
    items.push({ field: FIBRES_FIELD, pct: (totals.fib || 0) / settings.goal_fibres })
  }
  for (const field of CLAIM_MICRO_FIELDS) {
    const val = (field.sumKeys || [field.key]).reduce((s, k) => s + (totals[k] || 0), 0)
    items.push({ field, pct: val / field.ref })
  }

  return items
    .filter(i => i.pct < 1)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, limit)
    .map(i => ({ field: i.field, pct: Math.round(i.pct * 100) }))
}

// ── Formatage ───────────────────────────────────────────────────────────────
export function formatValue(val, unit) {
  if (val == null) return '—'
  if (val === 0) return `0 ${unit}`
  const abs = Math.abs(val)
  const rounded = abs >= 100 ? Math.round(val)
    : abs >= 10 ? Math.round(val * 10) / 10
    : abs >= 1  ? Math.round(val * 100) / 100
    : Math.round(val * 1000) / 1000
  return `${rounded} ${unit}`
}
