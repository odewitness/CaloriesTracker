import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useFeed — fil des recettes partagées, déjà filtré côté base par RLS (une
// utilisatrice ne reçoit que ses propres partages + ceux de ses amies
// acceptées) : pas de filtre .eq('user_id', ...) à ajouter côté client.
// ─────────────────────────────────────────────────────────────────────────────
export function useFeed() {
  const { user } = useAuth()
  const [partages, setPartages] = useState([])
  const [reactionsByPartage, setReactionsByPartage] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setPartages([]); setReactionsByPartage({}); setCommentCounts({}); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('partages_recettes')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = data || []
    setPartages(rows)

    if (rows.length > 0) {
      const ids = rows.map(r => r.id)
      const [{ data: reactions }, { data: comments }] = await Promise.all([
        supabase.from('reactions_partages').select('*').in('partage_id', ids),
        supabase.from('commentaires_partages').select('partage_id').in('partage_id', ids),
      ])
      const rGrouped = {}
      for (const r of reactions || []) {
        if (!rGrouped[r.partage_id]) rGrouped[r.partage_id] = []
        rGrouped[r.partage_id].push(r)
      }
      const cCounts = {}
      for (const c of comments || []) cCounts[c.partage_id] = (cCounts[c.partage_id] || 0) + 1
      setReactionsByPartage(rGrouped)
      setCommentCounts(cCounts)
    } else {
      setReactionsByPartage({})
      setCommentCounts({})
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Snapshot de la recette au moment du partage — ingredients au format
  // { food_name, food_source, food_ref_id, qty_g, energie_kcal, proteines,
  // glucides, lipides, fibres } (déjà l'échelle de base de la recette, cf.
  // RecipesSection). food_source/food_ref_id permettent, pour les
  // ingrédients Ciqual/OFF (bases publiques), de recharger le détail complet
  // des micronutriments lors d'un "Ajouter à mes recettes" par une amie —
  // voir addToMyRecipes dans SocialPage.jsx.
  const shareRecette = async ({ recette, ingredients, message }) => {
    if (!user) return { error: 'Non connecté' }
    const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()

    const payload = {
      auteur_id: user.id,
      auteur_pseudo: myProfile?.pseudo || null,
      auteur_prenom: myProfile?.prenom || null,
      recette_id: recette.id,
      nom: recette.nom,
      portions: recette.portions || 1,
      poids_cru_g: recette.poids_cru_g || null,
      poids_cuit_g: recette.poids_cuit_g || null,
      tare_g: recette.tare_g || null,
      categories: recette.categories || [],
      instructions: recette.instructions?.trim() || null,
      temps_preparation_min: recette.temps_preparation_min || null,
      temps_cuisson_min: recette.temps_cuisson_min || null,
      temps_repos_min: recette.temps_repos_min || null,
      energie_kcal: recette.energie_kcal ?? null,
      proteines: recette.proteines ?? null,
      glucides: recette.glucides ?? null,
      lipides: recette.lipides ?? null,
      fibres: recette.fibres ?? null,
      sel: recette.sel ?? null,
      sucres: recette.sucres ?? null,
      acides_gras_satures: recette.acides_gras_satures ?? null,
      message: message?.trim() || null,
    }

    const { data: partage, error } = await supabase.from('partages_recettes').insert(payload).select().single()
    if (error) return { error }

    if (ingredients?.length > 0) {
      const rows = ingredients.map((ing, idx) => ({
        partage_id: partage.id,
        food_name: ing.food_name,
        food_source: ing.food_source || null,
        food_ref_id: ing.food_ref_id || null,
        qty_g: ing.qty_g,
        energie_kcal: ing.energie_kcal ?? null,
        proteines: ing.proteines ?? null,
        glucides: ing.glucides ?? null,
        lipides: ing.lipides ?? null,
        fibres: ing.fibres ?? null,
        ordre: idx,
      }))
      const { error: ingError } = await supabase.from('partage_recette_ingredients').insert(rows)
      if (ingError) return { error: ingError }
    }

    await load()
    return { data: partage, error: null }
  }

  const deletePartage = async (id) => {
    const { error } = await supabase.from('partages_recettes').delete().eq('id', id)
    if (!error) setPartages(p => p.filter(x => x.id !== id))
    return { error }
  }

  // Toggle réaction directement depuis le fil (sans ouvrir le détail).
  const toggleReaction = async (partageId, emoji) => {
    if (!user) return
    const current = reactionsByPartage[partageId] || []
    const mine = current.find(r => r.emoji === emoji && r.user_id === user.id)
    if (mine) {
      const { error } = await supabase.from('reactions_partages').delete().eq('id', mine.id)
      if (!error) setReactionsByPartage(prev => ({ ...prev, [partageId]: (prev[partageId] || []).filter(r => r.id !== mine.id) }))
    } else {
      const { data, error } = await supabase
        .from('reactions_partages')
        .insert({ partage_id: partageId, user_id: user.id, emoji })
        .select()
        .single()
      if (!error && data) setReactionsByPartage(prev => ({ ...prev, [partageId]: [...(prev[partageId] || []), data] }))
    }
  }

  return { partages, reactionsByPartage, commentCounts, loading, shareRecette, deletePartage, toggleReaction, refetch: load }
}
