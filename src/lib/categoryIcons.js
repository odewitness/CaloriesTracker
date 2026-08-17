// ─────────────────────────────────────────────────────────────────────────────
// Emojis affichés devant les catégories d'aliments et de recettes, pour
// repérer plus vite les sections dans les listes groupées et les filtres.
// Purement visuel : ne touche pas aux libellés stockés en base.
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_CATEGORY_ICONS = {
  'Personnalisé': '✏️',
  'Compléments alimentaires': '💊',
  'Aides culinaires et ingrédients divers': '🧂',
  'Aliments infantiles': '🍼',
  'Eaux et autres boissons': '🥤',
  'Entrées et plats composés': '🍱',
  'Fruits, légumes, légumineuses et oléagineux': '🥦',
  'Glaces et sorbets': '🍨',
  'Matières grasses': '🧈',
  'Produits céréaliers': '🍞',
  'Produits laitiers': '🥛',
  'Produits sucrés': '🍬',
  'Viandes, oeufs, poissons': '🍗',
  // Libellés regroupés produits par getCategoryLabel() (explorateur Ciqual) :
  // il fusionne plusieurs catégories brutes sous un intitulé unique, qui n'est
  // pas toujours celui de l'import ANSES.
  'Viandes, œufs et poissons': '🍗',
  'Divers': '🗂️',
}

const RECIPE_CATEGORY_ICONS = {
  'Petit-déjeuner': '🥐',
  'Collation': '🍎',
  'Plat': '🍽️',
  'Accompagnement': '🥗',
  'Boisson': '🥤',
  'Dessert': '🍰',
  'Pain / pâtes': '🍝',
  'Sans catégorie': '🗂️',
}

export function getFoodCategoryIcon(categorie) {
  return FOOD_CATEGORY_ICONS[categorie] || '🍽️'
}

export function getRecipeCategoryIcon(categorie) {
  return RECIPE_CATEGORY_ICONS[categorie] || '🍽️'
}

// ─────────────────────────────────────────────────────────────────────────────
// Couleur d'accent par catégorie, pour les en-têtes de groupe des listes
// (bandeau + liseré). Reprend la palette existante (variables CSS --green,
// --amber, --coral, --blue, --purple) : pas de nouvelle couleur introduite.
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_VARS = {
  green:   { accent: 'var(--green)',  bg: 'var(--green-light)' },
  amber:   { accent: 'var(--amber)',  bg: 'var(--amber-light)' },
  coral:   { accent: 'var(--coral)',  bg: 'var(--coral-light)' },
  blue:    { accent: 'var(--blue)',   bg: 'var(--blue-light)' },
  purple:  { accent: 'var(--purple)', bg: 'var(--purple-light)' },
  neutral: { accent: 'var(--text-muted)', bg: 'var(--gray-bg)' },
}

const FOOD_CATEGORY_COLOR_KEYS = {
  'Personnalisé': 'purple',
  'Compléments alimentaires': 'purple',
  'Aides culinaires et ingrédients divers': 'amber',
  'Aliments infantiles': 'coral',
  'Eaux et autres boissons': 'blue',
  'Entrées et plats composés': 'coral',
  'Fruits, légumes, légumineuses et oléagineux': 'green',
  'Glaces et sorbets': 'blue',
  'Matières grasses': 'amber',
  'Produits céréaliers': 'amber',
  'Produits laitiers': 'blue',
  'Produits sucrés': 'coral',
  'Viandes, oeufs, poissons': 'coral',
  'Viandes, œufs et poissons': 'coral',
  'Divers': 'neutral',
}

const RECIPE_CATEGORY_COLOR_KEYS = {
  'Petit-déjeuner': 'amber',
  'Collation': 'green',
  'Plat': 'coral',
  'Accompagnement': 'green',
  'Boisson': 'blue',
  'Dessert': 'purple',
  'Pain / pâtes': 'amber',
  'Sans catégorie': 'neutral',
}

export function getFoodCategoryColor(categorie) {
  return COLOR_VARS[FOOD_CATEGORY_COLOR_KEYS[categorie]] || COLOR_VARS.neutral
}

export function getRecipeCategoryColor(categorie) {
  return COLOR_VARS[RECIPE_CATEGORY_COLOR_KEYS[categorie]] || COLOR_VARS.neutral
}
