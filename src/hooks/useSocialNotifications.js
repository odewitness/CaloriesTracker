import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SOCIAL_LAST_SEEN_KEY = 'social_last_seen'

// ─────────────────────────────────────────────────────────────────────────────
// useSocialNotifications — détecte une activité non vue sur le fil social :
// réaction/commentaire sur l'un de MES partages, ou réponse à l'un de MES
// commentaires, depuis la dernière visite (localStorage, même principe que
// le badge "Nouveautés" — pas de table de notifications dédiée, pas de
// suivi en temps réel, vérifié une fois à l'ouverture de l'app).
// ─────────────────────────────────────────────────────────────────────────────
export function useSocialNotifications() {
  const { user } = useAuth()
  const [hasUnseen, setHasUnseen] = useState(false)

  const check = useCallback(async () => {
    if (!user) { setHasUnseen(false); return }
    const lastSeen = localStorage.getItem(SOCIAL_LAST_SEEN_KEY) || '1970-01-01T00:00:00.000Z'

    const [{ data: myPartages }, { data: myComments }] = await Promise.all([
      supabase.from('partages_recettes').select('id').eq('auteur_id', user.id),
      supabase.from('commentaires_partages').select('id').eq('auteur_id', user.id),
    ])
    const partageIds = (myPartages || []).map(p => p.id)
    const commentIds = (myComments || []).map(c => c.id)

    const checks = []
    if (partageIds.length > 0) {
      checks.push(
        supabase.from('reactions_partages').select('id').in('partage_id', partageIds).neq('user_id', user.id).gt('created_at', lastSeen)
      )
      checks.push(
        supabase.from('commentaires_partages').select('id').in('partage_id', partageIds).neq('auteur_id', user.id).gt('created_at', lastSeen)
      )
    }
    if (commentIds.length > 0) {
      checks.push(
        supabase.from('commentaires_partages').select('id').in('parent_id', commentIds).neq('auteur_id', user.id).gt('created_at', lastSeen)
      )
    }
    if (checks.length === 0) { setHasUnseen(false); return }
    const results = await Promise.all(checks)
    setHasUnseen(results.some(r => (r.data || []).length > 0))
  }, [user])

  useEffect(() => { check() }, [check])

  const markSeen = () => {
    localStorage.setItem(SOCIAL_LAST_SEEN_KEY, new Date().toISOString())
    setHasUnseen(false)
  }

  return { hasUnseen, markSeen, refetch: check }
}
