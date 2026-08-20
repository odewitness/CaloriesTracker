import { supabase } from './supabase'
import { foodIdentity } from '../hooks/useFavorites'

// ─────────────────────────────────────────────────────────────────────────────
// logSuggestions — enregistre dans suggestions_manques les aliments
// effectivement suggérés pour combler un manque nutritionnel (voir
// TodayGapsSection.jsx, seul appelant actuel). Sert de matière première à
// useGroceriesSuggestions.js, qui fait remonter dans la liste de courses les
// aliments qui reviennent le plus souvent dans ces suggestions.
//
// Fire-and-forget : un échec d'écriture ne doit jamais perturber l'affichage
// des suggestions elles-mêmes, qui existaient déjà avant ce tracking.
//
// suggestions : [{ food, gap: { field }, coverage }] — même forme que la
// sortie de TodayGapsSection.suggestions.
// ─────────────────────────────────────────────────────────────────────────────
export function logSuggestions(suggestions) {
  if (!suggestions?.length) return
  const rows = suggestions.map(({ food, gap }) => {
    const { source, refId, name } = foodIdentity(food)
    return {
      food_source: source,
      food_ref_id: refId != null ? String(refId) : null,
      food_name: name,
      nutrient_key: gap.field.key,
    }
  })
  supabase.from('suggestions_manques').insert(rows).then(({ error }) => {
    if (error) console.error('Erreur log suggestion manque', error)
  })
}
