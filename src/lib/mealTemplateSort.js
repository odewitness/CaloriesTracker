// ─────────────────────────────────────────────────────────────────────────────
// Tri + filtre des repas types — même principe que recipeSort.js (recettes),
// adapté : repas_types n'a pas de colonnes nutritionnelles agrégées (juste
// items[]), les totaux sont donc recalculés à la volée depuis les items ; pas
// de durées (pas de temps de prépa/cuisson pour un repas type).
// ─────────────────────────────────────────────────────────────────────────────

export { filterByCategories } from './recipeSort'
export { filterBySeasons } from './seasons'

export const SORT_FIELDS = [
  { key: 'nom',       label: 'Nom',       ascLabel: 'A → Z',         descLabel: 'Z → A' },
  { key: 'kcal',      label: 'Calories',  ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'proteines', label: 'Protéines', ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'glucides',  label: 'Glucides',  ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
  { key: 'lipides',   label: 'Lipides',   ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
]

export const SORT_BASES = [
  { key: 'total',   label: 'Total du repas' },
  { key: 'portion', label: 'Par portion' },
]

export const DEFAULT_SORT = {
  primary: { field: 'nom', dir: 'asc' }, secondary: null, basis: 'total', categories: [], saisons: [],
}

function computeTotals(repas) {
  const items = repas.items || []
  return {
    energie_kcal: items.reduce((s, i) => s + (i.energie_kcal || 0), 0),
    proteines:    items.reduce((s, i) => s + (i.proteines || 0), 0),
    glucides:     items.reduce((s, i) => s + (i.glucides || 0), 0),
    lipides:      items.reduce((s, i) => s + (i.lipides || 0), 0),
  }
}

function getFieldValue(repas, field, basis) {
  const items = repas.items || []
  if (items.length === 0) return null
  const key = field === 'kcal' ? 'energie_kcal' : field
  const raw = computeTotals(repas)[key]
  if (basis !== 'portion') return raw
  const portions = repas.nb_portions || 1
  return raw / portions
}

export function compareByField(a, b, field, dir, basis) {
  if (field === 'nom') {
    const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr')
    return dir === 'desc' ? -cmp : cmp
  }
  const av = getFieldValue(a, field, basis), bv = getFieldValue(b, field, basis)
  // Un repas type sans aliment (cas limite) est toujours relégué en fin de liste.
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  // Comparaison sur la valeur arrondie telle qu'affichée à l'écran.
  const cmp = Math.round(av) - Math.round(bv)
  return dir === 'desc' ? -cmp : cmp
}

export function sortMealTemplates(list, { primary, secondary, basis }) {
  return [...list].sort((a, b) => {
    const c1 = compareByField(a, b, primary.field, primary.dir, basis)
    if (c1 !== 0) return c1
    if (secondary) {
      const c2 = compareByField(a, b, secondary.field, secondary.dir, basis)
      if (c2 !== 0) return c2
    }
    return (a.nom || '').localeCompare(b.nom || '', 'fr') // tie-break stable
  })
}

export function describeSortField({ field, dir }, basis) {
  const f = SORT_FIELDS.find(x => x.key === field)
  if (!f) return ''
  const base = `${f.label.toLowerCase()} (${(dir === 'asc' ? f.ascLabel : f.descLabel).toLowerCase()})`
  return field !== 'nom' && basis === 'portion' ? `${base}, par portion` : base
}

export function isCustomSort(sort) {
  return sort.primary.field !== 'nom' || sort.primary.dir !== 'asc' || !!sort.secondary || sort.basis === 'portion'
}

export function isCustomFilter(sort) {
  return (sort.categories || []).length > 0 || (sort.saisons || []).length > 0
}

export function describeActiveFilters(sort) {
  return [...(sort.categories || []), ...(sort.saisons || [])]
}
