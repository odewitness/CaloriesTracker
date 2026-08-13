// ─────────────────────────────────────────────────────────────────────────────
// Tri des recettes — critère principal + critère secondaire optionnel
// (ex: "moins caloriques, puis plus de protéines"). Logique pure, sans JSX,
// utilisée par components/SortModal.jsx et pages/ManualPage.jsx.
// ─────────────────────────────────────────────────────────────────────────────

export const SORT_FIELDS = [
  { key: 'nom',       label: 'Nom',       ascLabel: 'A → Z',         descLabel: 'Z → A' },
  { key: 'kcal',      label: 'Calories',  ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'proteines', label: 'Protéines', ascLabel: 'Les - élevées', descLabel: 'Les + élevées' },
  { key: 'glucides',  label: 'Glucides',  ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
  { key: 'lipides',   label: 'Lipides',   ascLabel: 'Les - élevés',  descLabel: 'Les + élevés' },
]

export const DEFAULT_SORT = { primary: { field: 'nom', dir: 'asc' }, secondary: null }

export function compareByField(a, b, field, dir) {
  if (field === 'nom') {
    const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr')
    return dir === 'desc' ? -cmp : cmp
  }
  const key = field === 'kcal' ? 'energie_kcal' : field
  const av = a[key], bv = b[key]
  // Les recettes sans valeur (pas d'ingrédient) sont toujours reléguées en
  // fin de liste, quel que soit le sens choisi.
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  const cmp = av - bv
  return dir === 'desc' ? -cmp : cmp
}

export function sortRecettes(list, { primary, secondary }) {
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
