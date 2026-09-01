import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useBatchCooking — page « Ma fournée » (roadmap §M9). Une check-list unique
// des recettes à cuisiner lors d'une session de meal prep, indépendante du
// planificateur. V1 : UNE liste courante par utilisatrice, table
// `batch_cooking_items` en RLS « own » (voir supabase/sql/batch_cooking_setup.sql).
//
// Une ligne = une recette : { id, recette_id, nom, portions, fait, created_at }.
// Ajout = insert (dédupliqué sur recette_id) ; cocher / éditer portions =
// update ; retrait = delete.
// ─────────────────────────────────────────────────────────────────────────────
export function useBatchCooking() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('batch_cooking_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Ajoute des recettes à la fournée. `recettes` : lignes `recettes`
  // ({ id, nom, portions }) OU objets { recette_id, nom, portions }. Les
  // recettes déjà présentes sont ignorées (contrainte unique user_id,recette_id).
  const addRecipes = useCallback(async (recettes, { portionsById } = {}) => {
    if (!user || !recettes?.length) return { error: null, added: 0 }
    const present = new Set(items.map(i => i.recette_id).filter(Boolean))
    const rows = recettes
      .map(r => ({
        recette_id: r.recette_id || r.id || null,
        nom: r.nom || 'Recette',
        portions: portionsById?.[r.recette_id || r.id] ?? r.portions ?? null,
      }))
      .filter(r => r.recette_id && !present.has(r.recette_id))
    if (!rows.length) return { error: null, added: 0 }
    const { error } = await supabase
      .from('batch_cooking_items')
      .insert(rows.map(r => ({ ...r, user_id: user.id })))
    if (!error) await load()
    return { error, added: rows.length }
  }, [user, items, load])

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
    if (!items.length) return { error: null }
    setItems([])
    const { error } = await supabase
      .from('batch_cooking_items')
      .delete()
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, items, load])

  return {
    items, loading,
    addRecipes, toggleFait, setPortions, removeItem, clearDone, clearAll,
    refetch: load,
  }
}
