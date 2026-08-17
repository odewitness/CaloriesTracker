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
// Tri neutre, et état par défaut de la page : classer par nom n'applique
// AUCUN point de vue nutritionnel sur la liste. Sans cette option, tout tri
// est forcément « par un nutriment » et il devient impossible de revenir à une
// liste non orientée. `virtual` = ce n'est pas une colonne de `ciqual`, donc
// à exclure de la projection SQL.
export const NAME_FIELD = { key: 'nom', label: 'Nom', unit: null, virtual: true }

export const SORT_GROUPS = [
  { label: 'Général',   fields: [NAME_FIELD] },
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
  ...ALL_SORT_FIELDS.filter(f => !f.virtual).flatMap(f => f.sumKeys || [f.key]),
])).join(',')

export function findField(key) {
  return ALL_SORT_FIELDS.find(f => f.key === key) || NAME_FIELD
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
  if (field.virtual) return null // le nom n'a pas de valeur chiffrée à comparer
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

const macro = (key) => MACRO_FIELDS.find(f => f.key === key)
const PROT_FIELD   = macro('proteines')
const GLUC_FIELD   = macro('glucides')
const LIP_FIELD    = macro('lipides')
const FIBRES_FIELD = macro('fibres')

export const CLAIM_GROUPS = [
  { label: 'Macros',    fields: [PROT_FIELD, GLUC_FIELD, LIP_FIELD, FIBRES_FIELD] },
  { label: 'Vitamines', fields: VITAMIN_FIELDS },
  { label: 'Minéraux',  fields: MINERAL_FIELDS.filter(f => !f.limite) },
]

// Part de l'énergie totale apportée par un macro (4 kcal/g pour protéines et
// glucides, 9 pour les lipides).
function energyShare(food, key) {
  const kcal = food.energie_kcal
  if (!kcal || kcal <= 0) return null
  const perG = key === 'lipides' ? 9 : 4
  return ((food[key] || 0) * perG) / kcal
}

// 'riche' | 'source' | null — pour UN nutriment donné, sur les valeurs /100 g.
export function getClaimLevel(food, field) {
  // Protéines et fibres ont des seuils d'allégation officiels (UE 1924/2006).
  if (field.key === 'proteines') {
    const share = energyShare(food, 'proteines')
    if (share == null) return null
    return share >= 0.20 ? 'riche' : share >= 0.12 ? 'source' : null
  }
  if (field.key === 'fibres') {
    const v = food.fibres
    if (v == null) return null
    return v >= 6 ? 'riche' : v >= 3 ? 'source' : null
  }
  // Glucides et lipides n'ont AUCUNE allégation officielle « riche en » — le
  // règlement ne valorise pas ces deux macros. On retombe donc sur le critère
  // de dominance énergétique déjà utilisé par getNutriBadge() dans
  // nutriBadge.js, pour que « riche en lipides » veuille dire la même chose
  // ici et sur les cartes de recettes/aliments : le macro fournit à lui seul
  // plus de la moitié de l'énergie de l'aliment.
  if (field.key === 'glucides' || field.key === 'lipides') {
    const share = energyShare(food, field.key)
    if (share == null) return null
    return share > 0.50 ? 'riche' : share > 0.30 ? 'source' : null
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
  for (const field of [PROT_FIELD, FIBRES_FIELD, GLUC_FIELD, LIP_FIELD, ...CLAIM_MICRO_FIELDS]) {
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

// La page s'ouvre sur un tri par nom : aucun nutriment n'est privilégié tant
// que l'utilisatrice n'en a pas choisi un. Ni les filtres ni le tri ne sont
// mémorisés d'une ouverture à l'autre — un réglage pris pour un besoin ponctuel
// ne doit pas devenir l'état permanent de la page.
export const DEFAULT_SORT = { field: 'nom', dir: 'asc', base: 'g100' }

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

// ── Résumé des filtres actifs ───────────────────────────────────────────────
// Les filtres doivent rester VISIBLES sur la page, pas seulement dans la
// feuille de réglages : sans ça, une liste restreinte à « riche en vitamine D »
// donne l'impression que le tri ne répond plus, alors que c'est le filtre qui
// limite les résultats. Chaque entrée est retirable individuellement.
export function describeActiveFilters(filters, remainingKcal) {
  const out = []
  for (const k of filters.claims) {
    out.push({ id: `claim:${k}`, kind: 'claim', value: k, label: `Riche en ${findField(k).label.toLowerCase()}` })
  }
  for (const c of filters.categories) {
    out.push({ id: `cat:${c}`, kind: 'category', value: c, label: c })
  }
  if (filters.favoritesOnly) out.push({ id: 'fav', kind: 'favoritesOnly', label: 'Mes favoris' })
  if (filters.fitsRemainingKcal) {
    out.push({
      id: 'kcal', kind: 'fitsRemainingKcal',
      label: remainingKcal != null ? `≤ ${Math.round(remainingKcal)} kcal` : 'Calories restantes',
    })
  }
  if (filters.showSeasonings) out.push({ id: 'seasoning', kind: 'showSeasonings', label: 'Épices affichées' })
  return out
}

export function removeFilter(filters, item) {
  if (item.kind === 'claim')    return { ...filters, claims: filters.claims.filter(k => k !== item.value) }
  if (item.kind === 'category') return { ...filters, categories: filters.categories.filter(c => c !== item.value) }
  return { ...filters, [item.kind]: false }
}

// Les valeurs manquantes finissent TOUJOURS en fin de liste, quel que soit le
// sens du tri. (En SQL, `order by ... desc` remonte les NULL en premier : la
// première page serait pleine d'aliments sans donnée. Même piège en JS si on
// traite null comme 0.)
export function sortFoods(foods, { field, dir, base }) {
  const f = findField(field)
  const mult = dir === 'asc' ? 1 : -1

  if (f.virtual) {
    return [...foods].sort((a, b) => mult * a.alim_nom.localeCompare(b.alim_nom, 'fr'))
  }

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
