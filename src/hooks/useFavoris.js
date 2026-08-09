import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Une "identité" d'aliment = source + référence stable (alim_code Ciqual, id
// custom...) ; si pas de référence (cas Open Food Facts sans code), on retombe
// sur le nom — ce n'est pas parfait mais c'est déjà le comportement existant
// ailleurs dans l'app (food_ref_id peut être null pour les entrées 'off').
export function foodIdentity(food) {
  const source = food._source || food.food_source || 'ciqual'
  const refId = food.alim_code || food.id || food.food_ref_id || null
  const name = food.alim_nom || food.food_name
  return { source, refId, name, key: `${source}:${refId ?? name}` }
}

// ── bumpFavoriUsage ───────────────────────────────────────────────────────
// Appelée par useJournal.addEntry après chaque ajout au journal. Si l'aliment
// ajouté correspond à un favori existant, incrémente son compteur d'usage et
// note la date — sert au tri "Plus utilisés" / "Récents" dans FoodPicker.
// Ne fait rien si l'aliment n'est pas (ou plus) favori. Volontairement non
// bloquante côté appelant : un échec ici ne doit jamais faire échouer l'ajout
// au journal lui-même.
//
// IMPORTANT : `entry` est ici la LIGNE DU JOURNAL telle que retournée par
// Supabase après insertion — elle a donc son propre `id` (clé primaire de la
// ligne `journal`), distinct de l'identifiant de l'aliment. On lit donc
// directement food_source/food_ref_id/food_name (déjà corrects, posés par
// scaleFood() au moment de l'ajout) plutôt que de repasser par foodIdentity(),
// qui est conçue pour des objets "aliment brut" de recherche où `food.id` sert
// de repli pour les aliments personnalisés — un repli qui, ici, capterait à
// tort l'id de la ligne journal.
export async function bumpFavoriUsage(userId, entry) {
  if (!userId) return
  try {
    const source = entry.food_source || 'ciqual'
    const refId  = entry.food_ref_id ?? null
    const name   = entry.food_name

    let query = supabase
      .from('favoris')
      .select('id, use_count')
      .eq('user_id', userId)
      .eq('food_source', source)
    query = refId != null
      ? query.eq('food_ref_id', String(refId))
      : query.is('food_ref_id', null).eq('food_name', name)

    const { data } = await query.limit(1)
    const row = data?.[0]
    if (!row) return // pas un favori — rien à faire

    await supabase
      .from('favoris')
      .update({ use_count: (row.use_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq('id', row.id)
  } catch (e) {
    console.error('bumpFavoriUsage error:', e)
  }
}

export function useFavoris() {
  const { user } = useAuth()
  const [favoris, setFavoris] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) { setFavoris([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('favoris')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setFavoris(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const favKeySet = new Set(favoris.map(f => `${f.food_source}:${f.food_ref_id ?? f.food_name}`))

  const isFavorite = useCallback((food) => favKeySet.has(foodIdentity(food).key), [favoris])

  // food = l'objet complet tel que manipulé par AddFoodModal (alim_nom, valeurs
  // pour 100g, portions, _source, alim_code/id...) — on le stocke tel quel.
  const toggleFavorite = async (food) => {
    if (!user?.id) return
    const { source, refId, name, key } = foodIdentity(food)
    const existing = favoris.find(f => `${f.food_source}:${f.food_ref_id ?? f.food_name}` === key)

    if (existing) {
      await supabase.from('favoris').delete().eq('id', existing.id).eq('user_id', user.id)
      setFavoris(f => f.filter(x => x.id !== existing.id))
    } else {
      const { data, error } = await supabase
        .from('favoris')
        .insert([{ user_id: user.id, food_source: source, food_ref_id: refId ? String(refId) : null, food_name: name, food_data: food }])
        .select()
        .single()
      if (!error && data) setFavoris(f => [data, ...f])
    }
  }

  return { favoris, loading, isFavorite, toggleFavorite }
}