import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useMealPlans — plans de repas enregistrés (table plans_repas). Historique du
// planificateur : garder un plan généré sous un nom, le revoir, le renommer,
// le ré-appliquer plus tard. Voir supabase/sql/plans_repas_setup.sql.
//
// Une ligne : { id, nom, config, plan, created_at, updated_at }.
// ─────────────────────────────────────────────────────────────────────────────
export function useMealPlans() {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setPlans([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('plans_repas')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const savePlan = useCallback(async ({ nom, config, plan }) => {
    if (!user) return { error: 'no-user' }
    const { data, error } = await supabase
      .from('plans_repas')
      .insert([{ user_id: user.id, nom: (nom || 'Plan').trim() || 'Plan', config: config || {}, plan: plan || {} }])
      .select()
      .single()
    if (!error) await load()
    return { data, error }
  }, [user, load])

  const updatePlan = useCallback(async (id, patch) => {
    if (!user) return { error: 'no-user' }
    const row = { updated_at: new Date().toISOString() }
    if (patch.nom != null) row.nom = patch.nom.trim() || 'Plan'
    if (patch.config != null) row.config = patch.config
    if (patch.plan != null) row.plan = patch.plan
    const { error } = await supabase
      .from('plans_repas')
      .update(row)
      .eq('id', id)
      .eq('user_id', user.id)
    if (!error) await load()
    return { error }
  }, [user, load])

  const renamePlan = useCallback((id, nom) => updatePlan(id, { nom }), [updatePlan])

  const deletePlan = useCallback(async (id) => {
    if (!user) return { error: 'no-user' }
    setPlans(list => list.filter(p => p.id !== id))
    const { error } = await supabase
      .from('plans_repas')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, load])

  return { plans, loading, savePlan, updatePlan, renamePlan, deletePlan, refetch: load }
}
