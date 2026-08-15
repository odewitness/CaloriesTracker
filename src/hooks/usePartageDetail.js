import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// usePartageDetail — charge un partage de recette + ses
// ingrédients/réactions/commentaires par id. Visibilité déjà garantie par
// RLS (auteure ou amie acceptée).
// ─────────────────────────────────────────────────────────────────────────────
export function usePartageDetail(partageId) {
  const { user } = useAuth()
  const [partage, setPartage] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [reactions, setReactions] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!partageId) return
    setLoading(true)
    const [{ data: p }, { data: ing }, { data: react }, { data: comm }] = await Promise.all([
      supabase.from('partages_recettes').select('*').eq('id', partageId).single(),
      supabase.from('partage_recette_ingredients').select('*').eq('partage_id', partageId).order('ordre', { ascending: true }),
      supabase.from('reactions_partages').select('*').eq('partage_id', partageId),
      supabase.from('commentaires_partages').select('*').eq('partage_id', partageId).order('created_at', { ascending: true }),
    ])
    setPartage(p || null)
    setIngredients(ing || [])
    setReactions(react || [])
    setComments(comm || [])
    setLoading(false)
  }, [partageId])

  useEffect(() => { load() }, [load])

  // Toggle : ajoute la réaction si l'utilisatrice ne l'a pas encore mise sur
  // ce partage avec cet emoji, la retire sinon.
  const toggleReaction = async (emoji) => {
    if (!user) return
    const mine = reactions.find(r => r.emoji === emoji && r.user_id === user.id)
    if (mine) {
      const { error } = await supabase.from('reactions_partages').delete().eq('id', mine.id)
      if (!error) setReactions(rs => rs.filter(r => r.id !== mine.id))
    } else {
      const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
      const { data, error } = await supabase
        .from('reactions_partages')
        .insert({ partage_id: partageId, user_id: user.id, emoji, user_pseudo: myProfile?.pseudo || null, user_prenom: myProfile?.prenom || null })
        .select()
        .single()
      if (!error && data) setReactions(rs => [...rs, data])
    }
  }

  const addComment = async (contenu, parentId = null) => {
    if (!user || !contenu.trim()) return { error: 'vide' }
    const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
    const { data, error } = await supabase
      .from('commentaires_partages')
      .insert({
        partage_id: partageId,
        parent_id: parentId,
        auteur_id: user.id,
        auteur_pseudo: myProfile?.pseudo || null,
        auteur_prenom: myProfile?.prenom || null,
        contenu: contenu.trim(),
      })
      .select()
      .single()
    if (!error && data) setComments(c => [...c, data])
    return { data, error }
  }

  const deleteComment = async (id) => {
    const { error } = await supabase.from('commentaires_partages').delete().eq('id', id)
    // Les réponses sont supprimées en cascade côté base (parent_id ... on
    // delete cascade) — on reflète ça côté client pour ne pas garder de
    // réponses orphelines affichées.
    if (!error) setComments(c => c.filter(x => x.id !== id && x.parent_id !== id))
    return { error }
  }

  return { partage, ingredients, reactions, comments, loading, refetch: load, toggleReaction, addComment, deleteComment }
}
