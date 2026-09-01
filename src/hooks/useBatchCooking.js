import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useBatchCooking — page « Ma fournée » (roadmap §M9). Check-list des recettes
// à cuisiner pour UNE semaine donnée (`semaine` = lundi 'YYYY-MM-DD', même
// convention que le calendrier). Chaque semaine de la vue Menus a sa propre
// fournée. Table `batch_cooking_items` en RLS « own »
// (voir supabase/sql/batch_cooking_setup.sql).
//
// Une ligne = une recette : { id, semaine, recette_id, nom, portions, fait }.
// Ajout = upsert dédupliqué sur (user_id, semaine, recette_id) ; cocher /
// éditer portions = update ; retrait = delete.
// ─────────────────────────────────────────────────────────────────────────────
export function useBatchCooking(semaine) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !semaine) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('batch_cooking_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('semaine', semaine)
      .order('created_at', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }, [user, semaine])

  useEffect(() => { load() }, [load])

  // Ajoute des recettes à la fournée de la semaine. `recettes` : lignes
  // `recettes` ({ id, nom, portions }) OU objets { recette_id, nom, portions }.
  // Les recettes déjà présentes cette semaine-là sont laissées telles quelles
  // (upsert ON CONFLICT DO NOTHING — `fait` et `portions` non écrasés).
  const addRecipes = useCallback(async (recettes, { portionsById } = {}) => {
    if (!user || !semaine || !recettes?.length) return { error: null, added: 0 }
    const seen = new Set()
    const rows = recettes
      .map(r => ({
        recette_id: r.recette_id || r.id || null,
        nom: r.nom || 'Recette',
        portions: portionsById?.[r.recette_id || r.id] ?? r.portions ?? null,
      }))
      .filter(r => {
        if (!r.recette_id || seen.has(r.recette_id)) return false
        seen.add(r.recette_id)
        return true
      })
    if (!rows.length) return { error: null, added: 0 }
    const { data, error } = await supabase
      .from('batch_cooking_items')
      .upsert(
        rows.map(r => ({ ...r, user_id: user.id, semaine })),
        { onConflict: 'user_id,semaine,recette_id', ignoreDuplicates: true },
      )
      .select()
    if (!error) await load()
    return { error, added: (data || []).length }
  }, [user, semaine, load])

  const toggleFait = useCallback(async (id, fait) => {
    setItems(list => list.map(i => i.id === id ? { ...i, fait } : i)) // optimiste
    const { error } = await supabase
      .from('batch_cooking_items')
      .update({ fait })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load() // rollback si échec réseau
    return { error }
  }, [user, load])

  const setPortions = useCallback(async (id, portions) => {
    const value = portions === '' || portions == null || Number.isNaN(Number(portions))
      ? null
      : Number(portions)
    setItems(list => list.map(i => i.id === id ? { ...i, portions: value } : i))
    const { error } = await supabase
      .from('batch_cooking_items')
      .update({ portions: value })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, load])

  const removeItem = useCallback(async (id) => {
    setItems(list => list.filter(i => i.id !== id))
    const { error } = await supabase
      .from('batch_cooking_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, load])

  // Vide les recettes cochées « fait » (fin de session de meal prep).
  const clearDone = useCallback(async () => {
    const doneIds = items.filter(i => i.fait).map(i => i.id)
    if (!doneIds.length) return { error: null }
    setItems(list => list.filter(i => !i.fait))
    const { error } = await supabase
      .from('batch_cooking_items')
      .delete()
      .in('id', doneIds)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, items, load])

  const clearAll = useCallback(async () => {
    if (!items.length || !semaine) return { error: null }
    setItems([])
    const { error } = await supabase
      .from('batch_cooking_items')
      .delete()
      .eq('user_id', user.id)
      .eq('semaine', semaine)
    if (error) load()
    return { error }
  }, [user, semaine, items, load])

  return {
    items, loading,
    addRecipes, toggleFait, setPortions, removeItem, clearDone, clearAll,
    refetch: load,
  }
}
