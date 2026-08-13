// ─────────────────────────────────────────────────────────────────────────────
// Tri + filtre des aliments personnalisés — même logique que recipeSort.js,
// adaptée à un aliment : une seule catégorie (pas multi comme les recettes) et
// pas de notion de "portion du plat" (pas de base pour 100g / par portion à
// choisir, un aliment personnalisé n'a que sa valeur pour 100g / par dose).
// Logique pure, utilisée par FoodSortModal.jsx et CustomFoodsSection.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export const SORT_FIELDS = [
  { key: 'nom',       label: 'Nom',       ascLabel: 'A → Z',         descLabel: 'Z → A' },
  { key: 'kcal',      label: 'Calories',  ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'proteines', label: 'Protéines', ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'glucides',  label: 'Glucides',  ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
  { key: 'lipides',   label: 'Lipides',   ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
]

export const DEFAULT_SORT = { primary: { field: 'nom', dir: 'asc' }, secondary: null, categories: [] }

// Un aliment matche le filtre si sa catégorie est parmi celles sélectionnées
// (contrairement à une recette, un aliment n'a qu'une seule catégorie).
export function filterByCategories(list, categories) {
  if (!categories || categories.length === 0) return list
  return list.filter(a => categories.includes(a.categorie || 'Personnalisé'))
}

function getFieldValue(aliment, field) {
  const key = field === 'kcal' ? 'energie_kcal' : field
  return aliment[key]
}

export function compareByField(a, b, field, dir) {
  if (field === 'nom') {
    const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr')
    return dir === 'desc' ? -cmp : cmp
  }
  const av = getFieldValue(a, field), bv = getFieldValue(b, field)
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  const cmp = av - bv
  return dir === 'desc' ? -cmp : cmp
}

export function sortAliments(list, { primary, secondary }) {
  return [...list].sort((a, b) => {
    const c1 = compareByField(a, b, primary.field, primary.dir)
    if (c1 !== 0) return c1
    if (secondary) {
      const c2 = compareByField(a, b, secondary.field, secondary.dir)
      if (c2 !== 0) return c2
    }
    return (a.nom || '').localeCompare(b.nom || '', 'fr') // tie-break stable
  })
}

export function describeSortField({ field, dir }) {
  const f = SORT_FIELDS.find(x => x.key === field)
  if (!f) return ''
  return `${f.label.toLowerCase()} (${(dir === 'asc' ? f.ascLabel : f.descLabel).toLowerCase()})`
}

export function isCustomSort(sort) {
  return sort.primary.field !== 'nom' || sort.primary.dir !== 'asc' || !!sort.secondary
}

export function isCustomFilter(sort) {
  return !!sort.categories && sort.categories.length > 0
}
