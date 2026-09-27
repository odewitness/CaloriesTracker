import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { addDaysStr } from '../lib/sleep'

// Nuits chargées avant `dateStr` : de quoi calculer les horaires habituels
// (14 nuits du même type de jour → ~7 semaines pour le week-end), la dette sur
// 7 nuits et le mini-histogramme de la carte.
const HISTORY_DAYS = 60

// ─────────────────────────────────────────────────────────────────────────────
// useSleep(dateStr) — nuits de sommeil (table `sommeil`) autour du jour affiché.
// Une nuit est rattachée à la date du RÉVEIL (voir src/lib/sleep.js).
//
//   night   : nuit qui s'est terminée le matin de `dateStr`, ou null
//   nights  : nuits des 60 jours précédents + `dateStr` (triées par date)
//   save(payload)  : upsert de la nuit de `dateStr` (payload complet, sans date/user_id)
//   update(patch)  : modifie quelques champs de la nuit existante
//   remove()       : supprime la nuit de `dateStr`
// ─────────────────────────────────────────────────────────────────────────────
export function useSleep(dateStr) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const d = dateStr ? fmt(dateStr) : null
  const from = d ? addDaysStr(d, -HISTORY_DAYS) : null

  const load = useCallback(async () => {
    if (!user?.id || !d) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('sommeil')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', d)
      .order('date', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }, [user?.id, d, from])

  useEffect(() => { load() }, [load])

  const night = useMemo(() => rows.find(r => r.date === d) || null, [rows, d])

  const save = async (payload) => {
    if (!user?.id || !d) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('sommeil')
      .upsert(
        [{ ...payload, date: d, user_id: user.id, updated_at: new Date().toISOString() }],
        { onConflict: 'user_id,date' },
      )
      .select()
      .single()
    if (!error && data) {
      setRows(r => [...r.filter(x => x.date !== d), data].sort((a, b) => (a.date < b.date ? -1 : 1)))
    }
    return { data, error }
  }

  // Mise à jour partielle de la nuit existante (ex. qualité notée après un
  // « Comme d'habitude ») — pas via upsert : l'INSERT d'un upsert partiel
  // violerait le NOT NULL de duree_min avant même la résolution du conflit.
  const update = async (patch) => {
    if (!user?.id || !d) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('sommeil')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', d)
      .select()
      .single()
    if (!error && data) setRows(r => r.map(x => (x.date === d ? data : x)))
    return { data, error }
  }

  const remove = async () => {
    if (!user?.id || !d) return { error: 'Non connecté' }
    const prev = rows
    setRows(r => r.filter(x => x.date !== d))
    const { error } = await supabase
      .from('sommeil')
      .delete()
      .eq('user_id', user.id)
      .eq('date', d)
    if (error) setRows(prev)
    return { error }
  }

  return { night, nights: rows, loading, save, update, remove, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useSleepRange(start, end) — nuits sur une plage de dates (bornes incluses),
// pour l'onglet « Sommeil » de l'Historique et l'objectif suggéré du Profil.
// Au plus une ligne par jour : une année reste sous le plafond PostgREST de
// 1000 lignes, pas besoin de fetchAllRows.
// ─────────────────────────────────────────────────────────────────────────────
export function useSleepRange(start, end) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user?.id || !start || !end) { setRows([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('sommeil')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
      if (!cancelled) { setRows(data || []); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, start, end])

  return { nights: rows, loading }
}
