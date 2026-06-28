import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'

// ─────────────────────────────────────────────────────────────────────────────
// useRecipes — charge la liste des recettes de l'utilisateur
// ─────────────────────────────────────────────────────────────────────────────
export function useRecipes() {
  const { user } = useAuth()
  const [recettes, setRecettes] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!user) { setRecettes([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('recettes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRecettes(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Supprimer une recette (cascade sur les ingrédients via FK) ────────────
  const deleteRecette = async (id) => {
    const { error } = await supabase
      .from('recettes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) setRecettes(r => r.filter(x => x.id !== id))
    return { error }
  }

  return { recettes, loading, deleteRecette, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useRecetteDetail — charge une recette + ses ingrédients
// ─────────────────────────────────────────────────────────────────────────────
export function useRecetteDetail(recetteId) {
  const { user } = useAuth()
  const [recette,      setRecette]      = useState(null)
  const [ingredients,  setIngredients]  = useState([])
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    if (!recetteId || !user) return
    setLoading(true)
    const [{ data: r }, { data: ing }] = await Promise.all([
      supabase.from('recettes').select('*').eq('id', recetteId).eq('user_id', user.id).single(),
      supabase.from('recette_ingredients').select('*').eq('recette_id', recetteId).eq('user_id', user.id).order('created_at', { ascending: true }),
    ])
    setRecette(r || null)
    setIngredients(ing || [])
    setLoading(false)
  }, [recetteId, user])

  useEffect(() => { load() }, [load])

  return { recette, ingredients, loading, refetch: load, setRecette, setIngredients }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de calcul nutritionnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Somme les nutriments de tous les ingrédients (valeurs déjà scalées au poids).
 * Retourne un objet { energie_kcal, proteines, glucides, lipides, fibres, sel,
 *                     sucres, acides_gras_satures, ...ALL_NUTRIENT_KEYS }
 */
export function sumIngredients(ingredients) {
  const t = {
    energie_kcal: 0, proteines: 0, glucides: 0,
    lipides: 0, fibres: 0, sel: 0, sucres: 0, acides_gras_satures: 0,
  }
  for (const key of ALL_NUTRIENT_KEYS) t[key] = 0

  for (const ing of ingredients) {
    t.energie_kcal        += ing.energie_kcal        || 0
    t.proteines           += ing.proteines           || 0
    t.glucides            += ing.glucides            || 0
    t.lipides             += ing.lipides             || 0
    t.fibres              += ing.fibres              || 0
    t.sel                 += ing.sel                 || 0
    t.sucres              += ing.sucres              || 0
    t.acides_gras_satures += ing.acides_gras_satures || 0
    for (const key of ALL_NUTRIENT_KEYS) t[key] += ing[key] || 0
  }
  return t
}

/**
 * Calcule les valeurs nutritionnelles pour 100 g de plat cuit.
 * poidsReferenceG = poids cuit s'il est renseigné, sinon poids cru total.
 */
export function calcPer100g(totaux, poidsReferenceG) {
  if (!poidsReferenceG || poidsReferenceG <= 0) return null
  const factor = 100 / poidsReferenceG
  const per100 = {}
  per100.energie_kcal        = parseFloat(((totaux.energie_kcal        || 0) * factor).toFixed(1))
  per100.proteines           = parseFloat(((totaux.proteines           || 0) * factor).toFixed(2))
  per100.glucides            = parseFloat(((totaux.glucides            || 0) * factor).toFixed(2))
  per100.lipides             = parseFloat(((totaux.lipides            || 0) * factor).toFixed(2))
  per100.fibres              = parseFloat(((totaux.fibres              || 0) * factor).toFixed(2))
  per100.sel                 = parseFloat(((totaux.sel                 || 0) * factor).toFixed(2))
  per100.sucres              = parseFloat(((totaux.sucres              || 0) * factor).toFixed(2))
  per100.acides_gras_satures = parseFloat(((totaux.acides_gras_satures || 0) * factor).toFixed(2))
  for (const key of ALL_NUTRIENT_KEYS) {
    per100[key] = totaux[key] != null ? parseFloat((totaux[key] * factor).toFixed(4)) : null
  }
  return per100
}

// ─────────────────────────────────────────────────────────────────────────────
// saveRecette — crée ou met à jour une recette + remplace ses ingrédients
// ─────────────────────────────────────────────────────────────────────────────
export async function saveRecette({ userId, recetteId, nom, portions, poidsReferenceG, poidsCuitG, poidsCruG, ingredients }) {
  const totaux  = sumIngredients(ingredients)
  const per100  = calcPer100g(totaux, poidsReferenceG)

  const payload = {
    nom:          nom.trim(),
    portions:     portions || 1,
    poids_cru_g:  poidsCruG  || null,
    poids_cuit_g: poidsCuitG || null,
    energie_kcal:         per100?.energie_kcal         ?? null,
    proteines:            per100?.proteines            ?? null,
    glucides:             per100?.glucides             ?? null,
    lipides:              per100?.lipides              ?? null,
    fibres:               per100?.fibres               ?? null,
    sel:                  per100?.sel                  ?? null,
    sucres:               per100?.sucres               ?? null,
    acides_gras_satures:  per100?.acides_gras_satures  ?? null,
  }
  for (const key of ALL_NUTRIENT_KEYS) {
    payload[key] = per100?.[key] ?? null
  }

  let id = recetteId
  if (recetteId) {
    // Mise à jour
    const { error } = await supabase
      .from('recettes')
      .update(payload)
      .eq('id', recetteId)
      .eq('user_id', userId)
    if (error) return { error }
  } else {
    // Création
    const { data, error } = await supabase
      .from('recettes')
      .insert([{ ...payload, user_id: userId }])
      .select()
      .single()
    if (error) return { error }
    id = data.id
  }

  // Remplace tous les ingrédients (delete + insert)
  await supabase.from('recette_ingredients').delete().eq('recette_id', id).eq('user_id', userId)

  if (ingredients.length > 0) {
    const rows = ingredients.map(ing => ({ ...ing, recette_id: id, user_id: userId }))
    const { error } = await supabase.from('recette_ingredients').insert(rows)
    if (error) return { error }
  }

  return { id, error: null }
}
