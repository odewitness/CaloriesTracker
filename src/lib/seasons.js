// ─────────────────────────────────────────────────────────────────────────────
// Saisons assignables à une recette ou un repas type (multi-sélection). Même
// principe que recipeCategories.js : liste fixe, stockée en base dans une
// colonne text[] `saisons`. Utilisée par les formulaires (RecipeFormModal,
// EditMealTemplatePage), les filtres (SortModal, MealTemplateSortModal) et
// l'affichage des cartes.
// ─────────────────────────────────────────────────────────────────────────────

export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver']

const SEASON_ICONS = {
  'Printemps': '🌸',
  'Été': '☀️',
  'Automne': '🍂',
  'Hiver': '❄️',
}

export function getSeasonIcon(saison) {
  return SEASON_ICONS[saison] || '📅'
}

// Un élément matche le filtre s'il a au moins une des saisons sélectionnées ;
// aucune saison sélectionnée = pas de filtre (tout passe). Un élément sans
// aucune saison assignée est donc exclu dès qu'un filtre saison est actif —
// même comportement que filterByCategories.
export function filterBySeasons(list, seasons) {
  if (!seasons || seasons.length === 0) return list
  return list.filter(r => (r.saisons || []).some(s => seasons.includes(s)))
}
