import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Met en forme une ligne `amities` du point de vue de l'utilisatrice
// courante : ne garde que les infos de l'AUTRE personne de la relation
// (déjà dénormalisées sur la ligne, pas de lecture cross-utilisatrice de
// `profiles` nécessaire).
function normalize(row, otherIsDemandeur) {
  return {
    id: row.id,
    friendId: otherIsDemandeur ? row.demandeur_id : row.destinataire_id,
    pseudo: otherIsDemandeur ? row.demandeur_pseudo : row.destinataire_pseudo,
    prenom: otherIsDemandeur ? row.demandeur_prenom : row.destinataire_prenom,
    createdAt: row.created_at,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useFriends — gère les relations d'amitié (demande/acceptation mutuelle) :
// amies acceptées, demandes reçues/envoyées en attente, recherche par pseudo.
// ─────────────────────────────────────────────────────────────────────────────
export function useFriends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setFriends([]); setIncomingRequests([]); setOutgoingRequests([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('amities')
      .select('*')
      .order('created_at', { ascending: false })
    const rows = data || []

    setFriends(
      rows.filter(r => r.statut === 'acceptee')
        .map(r => normalize(r, r.demandeur_id !== user.id))
    )
    setIncomingRequests(
      rows.filter(r => r.statut === 'en_attente' && r.destinataire_id === user.id)
        .map(r => normalize(r, true))
    )
    setOutgoingRequests(
      rows.filter(r => r.statut === 'en_attente' && r.demandeur_id === user.id)
        .map(r => normalize(r, false))
    )
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Correspondance exacte uniquement (voir find_profile_by_pseudo côté SQL) —
  // retourne { id, pseudo, prenom } ou null si aucune correspondance.
  const searchByPseudo = async (pseudo) => {
    const { data, error } = await supabase.rpc('find_profile_by_pseudo', { p_pseudo: pseudo })
    return { data: data?.[0] || null, error }
  }

  const sendRequest = async (destinataire) => {
    if (!user) return { error: 'Non connecté' }
    const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
    const { error } = await supabase.from('amities').insert({
      demandeur_id: user.id,
      destinataire_id: destinataire.id,
      demandeur_pseudo: myProfile?.pseudo || null,
      demandeur_prenom: myProfile?.prenom || null,
      destinataire_pseudo: destinataire.pseudo || null,
      destinataire_prenom: destinataire.prenom || null,
    })
    if (!error) await load()
    return { error }
  }

  const acceptRequest = async (id) => {
    const { error } = await supabase
      .from('amities')
      .update({ statut: 'acceptee', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) await load()
    return { error }
  }

  // Réutilisé pour annuler une demande envoyée, refuser une demande reçue,
  // ou supprimer une amitié acceptée — les trois sont un simple DELETE.
  const removeOrDecline = async (id) => {
    const { error } = await supabase.from('amities').delete().eq('id', id)
    if (!error) await load()
    return { error }
  }

  return {
    friends, incomingRequests, outgoingRequests, loading,
    searchByPseudo, sendRequest, acceptRequest, removeOrDecline,
    refetch: load,
  }
}
