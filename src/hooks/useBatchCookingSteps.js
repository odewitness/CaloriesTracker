import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useBatchCookingSteps — « Plan de cuisine » de Ma fournée (roadmap §M9), pour
// UNE semaine (`semaine` = lundi 'YYYY-MM-DD'). Toutes les étapes d'instructions
// des recettes de la fournée de cette semaine, mises bout à bout, réordonnables
// à la main + cochables. Table `batch_cooking_steps` (RLS « own », voir
// supabase/sql/batch_cooking_steps_setup.sql).
//
// Une ligne = une étape : { id, semaine, recette_id, recette_nom, texte, ordre, fait }.
// ─────────────────────────────────────────────────────────────────────────────
export function useBatchCookingSteps(semaine) {
  const { user } = useAuth()
  const [steps, setSteps] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user || !semaine) { setSteps([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('batch_cooking_steps')
      .select('*')
      .eq('user_id', user.id)
      .eq('semaine', semaine)
      .order('ordre', { ascending: true })
    setSteps(data || [])
    setLoading(false)
  }, [user, semaine])

  useEffect(() => { load() }, [load])

  // Reconstruit le plan de la semaine : efface l'existant et réinsère `flat`
  // dans l'ordre donné. `flat` : [{ recette_id, recette_nom, texte }].
  const generate = useCallback(async (flat) => {
    if (!user || !semaine) return { error: null }
    await supabase.from('batch_cooking_steps').delete().eq('user_id', user.id).eq('semaine', semaine)
    if (!flat?.length) { setSteps([]); return { error: null } }
    const rows = flat.map((s, i) => ({
      user_id: user.id,
      semaine,
      recette_id: s.recette_id || null,
      recette_nom: s.recette_nom || 'Recette',
      texte: s.texte,
      ordre: i,
      fait: false,
    }))
    const { error } = await supabase.from('batch_cooking_steps').insert(rows)
    if (!error) await load()
    return { error }
  }, [user, semaine, load])

  const clear = useCallback(async () => {
    if (!user || !semaine) return { error: null }
    setSteps([])
    const { error } = await supabase.from('batch_cooking_steps').delete().eq('user_id', user.id).eq('semaine', semaine)
    if (error) load()
    return { error }
  }, [user, semaine, load])

  const toggleFait = useCallback(async (id, fait) => {
    setSteps(list => list.map(s => s.id === id ? { ...s, fait } : s))
    const { error } = await supabase
      .from('batch_cooking_steps')
      .update({ fait })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) load()
    return { error }
  }, [user, load])

  // Déplace l'étape `id` d'un cran (`dir` = -1 monter, +1 descendre) : on
  // échange sa valeur `ordre` avec celle de sa voisine et on persiste les deux.
  const move = useCallback(async (id, dir) => {
    const sorted = [...steps].sort((a, b) => a.ordre - b.ordre)
    const i = sorted.findIndex(s => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return
    const a = sorted[i]
    const b = sorted[j]
    // échange local optimiste
    setSteps(list => list.map(s => {
      if (s.id === a.id) return { ...s, ordre: b.ordre }
      if (s.id === b.id) return { ...s, ordre: a.ordre }
      return s
    }))
    const [r1, r2] = await Promise.all([
      supabase.from('batch_cooking_steps').update({ ordre: b.ordre }).eq('id', a.id).eq('user_id', user.id),
      supabase.from('batch_cooking_steps').update({ ordre: a.ordre }).eq('id', b.id).eq('user_id', user.id),
    ])
    if (r1.error || r2.error) load()
  }, [steps, user, load])

  return { steps, loading, generate, clear, toggleFait, move, refetch: load }
}
