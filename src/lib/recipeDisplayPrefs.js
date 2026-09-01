// Préférences d'affichage de la liste des recettes (onglet « Recettes » de
// ManualPage). Stockées en localStorage — donc mémorisées par appareil, non
// synchronisées entre appareils. Aucune donnée Supabase impliquée.

const STORAGE_KEY = 'recipe-display-prefs'

export const DEFAULT_RECIPE_DISPLAY_PREFS = {
  showType:    true,    // chips catégorie / type de recette sur la carte
  showSeasons: true,    // chips saisons
  showTime:    true,    // durée totale (prépa + cuisson + repos)
  showBadge:   true,    // badge « riche en… » (getNutriBadge)
  imageMode:   'thumb', // 'thumb' (miniature) | 'cover' (bandeau 16/10)
  layout:      'list',  // 'list' | 'grid'
}

export function loadRecipeDisplayPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_RECIPE_DISPLAY_PREFS }
    return { ...DEFAULT_RECIPE_DISPLAY_PREFS, ...raw }
  } catch {
    return { ...DEFAULT_RECIPE_DISPLAY_PREFS }
  }
}

export function saveRecipeDisplayPrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

export function isDefaultRecipeDisplayPrefs(prefs) {
  return Object.keys(DEFAULT_RECIPE_DISPLAY_PREFS)
    .every(k => prefs[k] === DEFAULT_RECIPE_DISPLAY_PREFS[k])
}
