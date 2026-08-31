import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useMealTemplateDetail — charge UN repas type par id, indépendamment de la
// liste chargée par MealTemplatesSection. Utilisé pour naviguer vers "sa page
// dédiée" depuis un contexte externe (ex: repas type planifié depuis le
// calendrier).
// ─────────────────────────────────────────────────────────────────────────────
export function useMealTemplateDetail(id) {
  const { user } = useAuth()
  const [repas, setRepas] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id || !user?.id) { setRepas(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('repas_types').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
    setRepas(data || null)
    setLoading(false)
  }, [id, user?.id])

  useEffect(() => { load() }, [load])

  return { repas, loading, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// saveMealTemplate — crée ou met à jour un repas type. Extrait de
// MealTemplatesSection.handleSave pour être réutilisable ailleurs (une seule
// source de vérité pour la logique d'enregistrement).
// ─────────────────────────────────────────────────────────────────────────────
export async function saveMealTemplate({ userId, repasTypeId, nom, description, items, nbPortions, categories = [], saisons = [] }) {
  if (repasTypeId) {
    const { data, error } = await supabase
      .from('repas_types')
      .update({ nom, description, items, nb_portions: nbPortions, categories, saisons, updated_at: new Date().toISOString() })
      .eq('id', repasTypeId)
      .eq('user_id', userId)
      .select()
      .single()
    return { data, error }
  }
  const { data, error } = await supabase
    .from('repas_types')
    .insert([{ nom, description, items, nb_portions: nbPortions, categories, saisons, user_id: userId }])
    .select()
    .single()
  return { data, error }
}

export async function deleteMealTemplate(id, userId) {
  const { error } = await supabase.from('repas_types').delete().eq('id', id).eq('user_id', userId)
  return { error }
}
