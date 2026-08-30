import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useSportPartageDetail — charge un partage de sport (séance ou résumé de
// semaine) + ses réactions / commentaires par id. Même pattern que
// useJournalPartageDetail, tables dédiées (partages_sport, reactions_sport,
// commentaires_sport). Pas de table de « détail » : le partage se suffit à
// lui-même.
// ─────────────────────────────────────────────────────────────────────────────
export function useSportPartageDetail(partageId) {
  const { user } = useAuth()
  const [partage, setPartage] = useState(null)
  const [reactions, setReactions] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!partageId) return
    setLoading(true)
    const [{ data: p }, { data: react }, { data: comm }] = await Promise.all([
      supabase.from('partages_sport').select('*').eq('id', partageId).single(),
      supabase.from('reactions_sport').select('*').eq('partage_id', partageId),
      supabase.from('commentaires_sport').select('*').eq('partage_id', partageId).order('created_at', { ascending: true }),
    ])
    setPartage(p || null)
    setReactions(react || [])
    setComments(comm || [])
    setLoading(false)
  }, [partageId])

  useEffect(() => { load() }, [load])

  const toggleReaction = async (emoji) => {
    if (!user) return
    const mine = reactions.find(r => r.emoji === emoji && r.user_id === user.id)
    if (mine) {
      const { error } = await supabase.from('reactions_sport').delete().eq('id', mine.id)
      if (!error) setReactions(rs => rs.filter(r => r.id !== mine.id))
    } else {
      const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
      const { data, error } = await supabase
        .from('reactions_sport')
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
      .from('commentaires_sport')
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
    const { error } = await supabase.from('commentaires_sport').delete().eq('id', id)
    if (!error) setComments(c => c.filter(x => x.id !== id && x.parent_id !== id))
    return { error }
  }

  return { partage, reactions, comments, loading, refetch: load, toggleReaction, addComment, deleteComment }
}
