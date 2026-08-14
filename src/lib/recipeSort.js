// ─────────────────────────────────────────────────────────────────────────────
// Tri + filtre des recettes — critère principal + critère secondaire optionnel
// (ex: "moins caloriques, puis plus de protéines"), et filtre par catégories
// (une recette matche si elle a au moins une des catégories sélectionnées).
// Logique pure, sans JSX, utilisée par components/SortModal.jsx et
// components/RecipesSection.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export const SORT_FIELDS = [
  { key: 'nom',       label: 'Nom',       ascLabel: 'A → Z',         descLabel: 'Z → A' },
  { key: 'kcal',      label: 'Calories',  ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'proteines', label: 'Protéines', ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'glucides',  label: 'Glucides',  ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
  { key: 'lipides',   label: 'Lipides',   ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
]

export const SORT_BASES = [
  { key: 'per100g', label: 'Pour 100 g' },
  { key: 'portion', label: 'Par portion' },
]

export const DEFAULT_SORT = {
  primary: { field: 'nom', dir: 'asc' }, secondary: null, basis: 'per100g',
  categories: [], prepRanges: [], cookRanges: [], restRanges: [],
}

// Une recette matche le filtre si elle a au moins une des catégories
// sélectionnées ; aucune catégorie sélectionnée = pas de filtre (tout passe).
export function filterByCategories(list, categories) {
  if (!categories || categories.length === 0) return list
  return list.filter(r => (r.categories || []).some(c => categories.includes(c)))
}

// ── Filtres par durée (préparation / cuisson / repos) ──────────────────────
// Tranches prédéfinies, affichées comme des puces à cocher (même logique
// "au moins une tranche sélectionnée matche" que les catégories).
export const PREP_TIME_RANGES = [
  { key: 'p15',  label: '≤ 15 min',  test: v => v != null && v <= 15 },
  { key: 'p30',  label: '15-30 min', test: v => v != null && v > 15 && v <= 30 },
  { key: 'p60',  label: '30-60 min', test: v => v != null && v > 30 && v <= 60 },
  { key: 'p60p', label: '> 1h',      test: v => v != null && v > 60 },
]

export const COOK_TIME_RANGES = PREP_TIME_RANGES

export const REST_TIME_RANGES = [
  { key: 'r0',    label: 'Sans repos',  test: v => v == null || v <= 0 },
  { key: 'r30',   label: '≤ 30 min',    test: v => v != null && v > 0 && v <= 30 },
  { key: 'r120',  label: '30 min - 2h', test: v => v != null && v > 30 && v <= 120 },
  { key: 'r120p', label: '> 2h',        test: v => v != null && v > 120 },
]

// Filtre générique par tranches de durée sur un champ de la recette.
// selectedKeys vide = pas de filtre (tout passe).
export function filterByTimeRanges(list, field, selectedKeys, ranges) {
  if (!selectedKeys || selectedKeys.length === 0) return list
  const activeRanges = ranges.filter(r => selectedKeys.includes(r.key))
  return list.filter(r => activeRanges.some(range => range.test(r[field])))
}

// Valeur numérique d'un champ pour une recette, selon la base choisie
// ('per100g' = valeur brute stockée, 'portion' = ramenée au poids d'une
// portion réelle, même calcul que l'affichage /portion de RecipeCard).
function getFieldValue(recette, field, basis) {
  const key = field === 'kcal' ? 'energie_kcal' : field
  const raw = recette[key]
  if (raw == null) return null
  if (basis !== 'portion') return raw
  const portions = recette.portions || 1
  const poidsRef = recette.poids_cuit_g || recette.poids_cru_g || null
  if (!poidsRef) return null
  const poidsParPortion = poidsRef / portions
  return raw * (poidsParPortion / 100)
}

export function compareByField(a, b, field, dir, basis) {
  if (field === 'nom') {
    const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr')
    return dir === 'desc' ? -cmp : cmp
  }
  const av = getFieldValue(a, field, basis), bv = getFieldValue(b, field, basis)
  // Les recettes sans valeur (pas d'ingrédient, ou pas de poids connu pour
  // ramener à la portion) sont toujours reléguées en fin de liste.
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  // Comparaison sur la valeur arrondie telle qu'affichée à l'écran : deux
  // recettes visuellement à égalité (ex. "53g" toutes les deux) doivent
  // laisser la main au critère de tri secondaire plutôt que se départager
  // sur un écart décimal invisible pour l'utilisatrice.
  const cmp = Math.round(av) - Math.round(bv)
  return dir === 'desc' ? -cmp : cmp
}

export function sortRecettes(list, { primary, secondary, basis }) {
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
  return [sort.categories, sort.prepRanges, sort.cookRanges, sort.restRanges].some(a => a && a.length > 0)
}

// Libellés lisibles de tous les filtres actifs (catégories + tranches de
// durée), pour l'affichage "Filtré par ..." de RecipesSection.
export function describeActiveFilters(sort) {
  const labels = [...(sort.categories || [])]
  for (const [selected, ranges] of [
    [sort.prepRanges, PREP_TIME_RANGES],
    [sort.cookRanges, COOK_TIME_RANGES],
    [sort.restRanges, REST_TIME_RANGES],
  ]) {
    for (const key of selected || []) {
      const range = ranges.find(r => r.key === key)
      if (range) labels.push(range.label)
    }
  }
  return labels
}
