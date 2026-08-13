// ─────────────────────────────────────────────────────────────────────────────
// Catégorie assignable à un aliment personnalisé (sélection unique, contrairement
// aux catégories multi-sélection des recettes). Reprend les grandes catégories
// Ciqual à effectif significatif + Personnalisé et Compléments alimentaires.
// Utilisées par le formulaire d'aliment, le filtre et le regroupement par
// défaut de CustomFoodsSection.
// ─────────────────────────────────────────────────────────────────────────────

const CIQUAL_CATEGORIES = [
  'Aides culinaires et ingrédients divers',
  'Aliments infantiles',
  'Eaux et autres boissons',
  'Entrées et plats composés',
  'Fruits, légumes, légumineuses et oléagineux',
  'Glaces et sorbets',
  'Matières grasses',
  'Produits céréaliers',
  'Produits laitiers',
  'Produits sucrés',
  'Viandes, oeufs, poissons',
]

export const COMPLEMENT_CATEGORY = 'Compléments alimentaires'

export const FOOD_CATEGORIES = ['Personnalisé', COMPLEMENT_CATEGORY, ...CIQUAL_CATEGORIES]
