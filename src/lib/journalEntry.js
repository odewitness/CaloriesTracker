import { ALL_NUTRIENT_KEYS } from './nutrients'

// Le journal stocke des valeurs déjà mises à l'échelle de qty_g (pas des
// valeurs /100g) — on doit donc "dé-proportionner" pour reconstruire un objet
// "food" réutilisable par AddFoodModal, dans le même format que les résultats
// de recherche (alim_nom, valeurs /100g, portions, _source...).
// Extrait de useRecentFoods.js pour être réutilisé par useMealSuggestions.js.
export function entryToFood(entry) {
  const f = entry.qty_g > 0 ? 100 / entry.qty_g : 0
  const food = {
    alim_nom: entry.food_name,
    categorie: 'Récent',
    alim_code: entry.food_source === 'ciqual' ? entry.food_ref_id : undefined,
    id: entry.food_source !== 'ciqual' ? entry.food_ref_id : undefined,
    energie_kcal: parseFloat(((entry.energie_kcal || 0) * f).toFixed(1)),
    proteines: parseFloat(((entry.proteines || 0) * f).toFixed(2)),
    glucides: parseFloat(((entry.glucides || 0) * f).toFixed(2)),
    lipides: parseFloat(((entry.lipides || 0) * f).toFixed(2)),
    fibres: parseFloat(((entry.fibres || 0) * f).toFixed(2)),
    // Pas de portions connues en base → on propose la dernière quantité utilisée.
    portions: entry.qty_g ? [{ label: 'Dernière quantité', g: entry.qty_g }] : [],
    _source: entry.food_source,
  }
  for (const key of ALL_NUTRIENT_KEYS) {
    const raw = entry[key]
    food[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
  }
  return food
}
