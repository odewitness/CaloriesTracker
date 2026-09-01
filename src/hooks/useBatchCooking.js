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
// Une ligne = une recette OU un repas type : { id, semaine, recette_id,
// repas_type_id, nom, portions, fait } (une seule des deux réfs est non nulle).
// Ajout = upsert dédupliqué sur (user_id, semaine, recette_id) et
// (user_id, semaine, repas_type_id) ; cocher / éditer portions = update ;
// retrait = delete.
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

  // Ajoute des recettes / repas types à la fournée de la semaine. `sources` :
  // objets { id, nom, portions?, kind: 'recette' | 'repas_type' } (kind par
  // défaut 'recette'). Les entrées déjà présentes cette semaine-là sont
  // laissées telles quelles (upsert ON CONFLICT DO NOTHING — `fait` et
  // `portions` non écrasés).
  const addSources = useCallback(async (sources, { portionsById } = {}) => {
    if (!user || !semaine || !sources?.length) return { error: null, added: 0 }
    const seen = new Set()
    const rows = sources
      .map(s => {
        const kind = s.kind === 'repas_type' ? 'repas_type' : 'recette'
        const id = s.id || s.recette_id || s.repas_type_id || null
        return {
          recette_id: kind === 'recette' ? id : null,
          repas_type_id: kind === 'repas_type' ? id : null,
          nom: s.nom || (kind === 'repas_type' ? 'Repas type' : 'Recette'),
          portions: portionsById?.[id] ?? s.portions ?? null,
          _kind: kind, _id: id,
        }
      })
      .filter(r => {
        if (!r._id || seen.has(`${r._kind}:${r._id}`)) return false
        seen.add(`${r._kind}:${r._id}`)
        return true
      })
    if (!rows.length) return { error: null, added: 0 }

    // Deux upserts : ON CONFLICT ne cible qu'une contrainte à la fois.
    const insert = async (subset, onConflict) => {
      if (!subset.length) return { added: 0, error: null }
      const { data, error } = await supabase
        .from('batch_cooking_items')
        .upsert(
          subset.map(r => ({
            user_id: user.id, semaine,
            recette_id: r.recette_id, repas_type_id: r.repas_type_id,
            nom: r.nom, portions: r.portions,
          })),
          { onConflict, ignoreDuplicates: true },
        )
        .select()
      return { added: (data || []).length, error }
    }
    const rec = await insert(rows.filter(r => r._kind === 'recette'), 'user_id,semaine,recette_id')
    if (rec.error) return { error: rec.error, added: 0 }
    const tpl = await insert(rows.filter(r => r._kind === 'repas_type'), 'user_id,semaine,repas_type_id')
    if (tpl.error) { await load(); return { error: tpl.error, added: rec.added } }
    await load()
    return { error: null, added: rec.added + tpl.added }
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
    addSources, toggleFait, setPortions, removeItem, clearDone, clearAll,
    refetch: load,
  }
}
