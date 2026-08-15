import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useJournalPartageDetail — charge un partage de journée/repas + ses
// aliments (si include_detail)/réactions/commentaires par id. Même pattern
// que usePartageDetail (recettes), tables dédiées (partages_journal,
// partage_journal_aliments, reactions_journal, commentaires_journal).
// ─────────────────────────────────────────────────────────────────────────────
export function useJournalPartageDetail(partageId) {
  const { user } = useAuth()
  const [partage, setPartage] = useState(null)
  const [aliments, setAliments] = useState([])
  const [reactions, setReactions] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!partageId) return
    setLoading(true)
    const [{ data: p }, { data: alim }, { data: react }, { data: comm }] = await Promise.all([
      supabase.from('partages_journal').select('*').eq('id', partageId).single(),
      supabase.from('partage_journal_aliments').select('*').eq('partage_id', partageId).order('ordre', { ascending: true }),
      supabase.from('reactions_journal').select('*').eq('partage_id', partageId),
      supabase.from('commentaires_journal').select('*').eq('partage_id', partageId).order('created_at', { ascending: true }),
    ])
    setPartage(p || null)
    setAliments(alim || [])
    setReactions(react || [])
    setComments(comm || [])
    setLoading(false)
  }, [partageId])

  useEffect(() => { load() }, [load])

  const toggleReaction = async (emoji) => {
    if (!user) return
    const mine = reactions.find(r => r.emoji === emoji && r.user_id === user.id)
    if (mine) {
      const { error } = await supabase.from('reactions_journal').delete().eq('id', mine.id)
      if (!error) setReactions(rs => rs.filter(r => r.id !== mine.id))
    } else {
      const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
      const { data, error } = await supabase
        .from('reactions_journal')
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
      .from('commentaires_journal')
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
    const { error } = await supabase.from('commentaires_journal').delete().eq('id', id)
    if (!error) setComments(c => c.filter(x => x.id !== id && x.parent_id !== id))
    return { error }
  }

  return { partage, aliments, reactions, comments, loading, refetch: load, toggleReaction, addComment, deleteComment }
}
