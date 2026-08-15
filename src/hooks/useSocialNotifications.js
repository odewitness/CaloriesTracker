import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const SOCIAL_LAST_SEEN_KEY = 'social_last_seen'

// Une entrée par type de partage : table du partage, table des réactions,
// table des commentaires — même structure pour recettes et journées/repas.
const PARTAGE_SOURCES = [
  { type: 'recette', partages: 'partages_recettes', reactions: 'reactions_partages', comments: 'commentaires_partages', selectCols: 'id, nom' },
  { type: 'journal', partages: 'partages_journal', reactions: 'reactions_journal', comments: 'commentaires_journal', selectCols: 'id, date, meal' },
]

function targetLabel(partage, type) {
  if (!partage) return null
  if (type === 'recette') return partage.nom
  const d = partage.date
    ? new Date(`${partage.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : ''
  return partage.meal ? `${partage.meal} du ${d}` : `journée du ${d}`
}

// ─────────────────────────────────────────────────────────────────────────────
// useSocialNotifications — construit le fil d'activité sur MES partages
// (recette ou journée/repas) : réactions, commentaires reçus, réponses à mes
// commentaires. Même principe que le badge "Nouveautés" pour le "non vu"
// (localStorage, pas de table de notifications dédiée, pas de temps réel,
// vérifié une fois à l'ouverture de l'app) — mais on garde ici la liste
// complète des items (pas juste un booléen) pour l'afficher dans un onglet
// "Activité".
// ─────────────────────────────────────────────────────────────────────────────
export function useSocialNotifications() {
  const { user } = useAuth()
  const [hasUnseen, setHasUnseen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    if (!user) { setHasUnseen(false); setItems([]); setLoading(false); return }
    setLoading(true)
    const lastSeen = localStorage.getItem(SOCIAL_LAST_SEEN_KEY) || '1970-01-01T00:00:00.000Z'

    const collected = []
    for (const src of PARTAGE_SOURCES) {
      const [{ data: myPartages }, { data: myComments }] = await Promise.all([
        supabase.from(src.partages).select(src.selectCols).eq('auteur_id', user.id),
        supabase.from(src.comments).select('id, partage_id').eq('auteur_id', user.id),
      ])
      const partageById = Object.fromEntries((myPartages || []).map(p => [p.id, p]))
      const partageIds = Object.keys(partageById)
      const commentIds = (myComments || []).map(c => c.id)

      if (partageIds.length > 0) {
        const [{ data: react }, { data: comm }] = await Promise.all([
          supabase.from(src.reactions).select('*').in('partage_id', partageIds).neq('user_id', user.id),
          supabase.from(src.comments).select('*').in('partage_id', partageIds).neq('auteur_id', user.id).is('parent_id', null),
        ])
        for (const r of react || []) {
          collected.push({
            id: `${src.type}-react-${r.id}`, type: 'reaction', partageType: src.type, partageId: r.partage_id,
            pseudo: r.user_pseudo, prenom: r.user_prenom, emoji: r.emoji,
            targetLabel: targetLabel(partageById[r.partage_id], src.type), createdAt: r.created_at,
          })
        }
        for (const c of comm || []) {
          collected.push({
            id: `${src.type}-comm-${c.id}`, type: 'comment', partageType: src.type, partageId: c.partage_id,
            pseudo: c.auteur_pseudo, prenom: c.auteur_prenom, contenu: c.contenu,
            targetLabel: targetLabel(partageById[c.partage_id], src.type), createdAt: c.created_at,
          })
        }
      }

      if (commentIds.length > 0) {
        const { data: replies } = await supabase.from(src.comments).select('*').in('parent_id', commentIds).neq('auteur_id', user.id)
        const missingIds = [...new Set((replies || []).map(r => r.partage_id))].filter(id => !partageById[id])
        let extra = {}
        if (missingIds.length > 0) {
          const { data: extraPartages } = await supabase.from(src.partages).select(src.selectCols).in('id', missingIds)
          extra = Object.fromEntries((extraPartages || []).map(p => [p.id, p]))
        }
        for (const rep of replies || []) {
          collected.push({
            id: `${src.type}-reply-${rep.id}`, type: 'reply', partageType: src.type, partageId: rep.partage_id,
            pseudo: rep.auteur_pseudo, prenom: rep.auteur_prenom, contenu: rep.contenu,
            targetLabel: targetLabel(partageById[rep.partage_id] || extra[rep.partage_id], src.type), createdAt: rep.created_at,
          })
        }
      }
    }

    collected.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    setItems(collected)
    setHasUnseen(collected.some(i => i.createdAt > lastSeen))
    setLoading(false)
  }, [user])

  useEffect(() => { check() }, [check])

  const markSeen = () => {
    localStorage.setItem(SOCIAL_LAST_SEEN_KEY, new Date().toISOString())
    setHasUnseen(false)
  }

  return { hasUnseen, items, loading, markSeen, refetch: check }
}
