import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { fmt } from '../lib/dates'
import { sortSelles } from '../lib/stool'
import { STOOL_TRACKER_USER_ID } from '../lib/featureFlags'

// ─────────────────────────────────────────────────────────────────────────────
// useSelles(dateStr) — passages du jour (table `selles`). Réservé au compte
// STOOL_TRACKER_USER_ID (voir featureFlags.js) : pour tout autre compte, pas
// de requête et la liste reste vide — la vraie barrière reste la RLS "own"
// côté base, ce garde-fou évite juste un appel réseau inutile.
//
//   entries : passages du jour, triés pour l'affichage
//   add(payload) / update(id, patch) / remove(id)
// ─────────────────────────────────────────────────────────────────────────────
export function useSelles(dateStr) {
  const { user } = useAuth()
  const allowed = user?.id === STOOL_TRACKER_USER_ID
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const d = fmt(dateStr)

  const load = useCallback(async () => {
    if (!allowed || !d) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('selles')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', d)
    setRows(data || [])
    setLoading(false)
  }, [allowed, user?.id, d])

  useEffect(() => { load() }, [load])

  const add = async (payload) => {
    if (!allowed) return { error: 'Non disponible' }
    const { data, error } = await supabase
      .from('selles')
      .insert([{ ...payload, date: payload.date || d, user_id: user.id }])
      .select()
      .single()
    if (!error && data) setRows(r => [...r, data])
    return { data, error }
  }

  const update = async (id, patch) => {
    if (!allowed) return { error: 'Non disponible' }
    const { data, error } = await supabase
      .from('selles')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (!error && data) setRows(r => r.map(x => (x.id === id ? data : x)))
    return { data, error }
  }

  const remove = async (id) => {
    if (!allowed) return { error: 'Non disponible' }
    const prev = rows
    setRows(r => r.filter(x => x.id !== id))
    const { error } = await supabase
      .from('selles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) setRows(prev)
    return { error }
  }

  return { entries: sortSelles(rows), loading, add, update, remove, refetch: load }
}

// ─────────────────────────────────────────────────────────────────────────────
// useSellesRange(start, end) — passages sur une plage de dates (bornes
// incluses), pour l'onglet « Digestion » de l'Historique
// (src/components/history/DigestionSection.jsx). Même garde-fou
// STOOL_TRACKER_USER_ID que useSelles ; pas de pagination fetchAllRows comme
// pour `journal`, le volume de passages reste très en dessous du plafond
// PostgREST même sur une année.
// ─────────────────────────────────────────────────────────────────────────────
export function useSellesRange(start, end) {
  const { user } = useAuth()
  const allowed = user?.id === STOOL_TRACKER_USER_ID
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!allowed || !start || !end) { setRows([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('selles')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })
      if (!cancelled) { setRows(data || []); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [allowed, user?.id, start, end])

  return { entries: sortSelles(rows), loading }
}

// ─────────────────────────────────────────────────────────────────────────────
// useLieuxSelles() — lieux déjà saisis sur le tracker (table `lieux_selles`),
// réutilisables via menu déroulant. Même principe que `marques` pour
// aliments_custom.marque (voir CustomFoodsSection.load/ensureMarque) :
// `selles.lieu` reste du texte libre, cette table peuple juste les
// suggestions.
//   lieux            : noms connus, triés
//   ensureLieu(nom)   : enregistre `nom` s'il est nouveau (silencieux sinon)
// ─────────────────────────────────────────────────────────────────────────────
export function useLieuxSelles() {
  const { user } = useAuth()
  const allowed = user?.id === STOOL_TRACKER_USER_ID
  const [lieux, setLieux] = useState([])

  useEffect(() => {
    if (!allowed) { setLieux([]); return }
    let cancelled = false
    supabase.from('lieux_selles').select('nom').eq('user_id', user.id).order('nom')
      .then(({ data }) => { if (!cancelled) setLieux((data || []).map(l => l.nom)) })
    return () => { cancelled = true }
  }, [allowed, user?.id])

  const ensureLieu = async (nom) => {
    if (!allowed || !nom || lieux.some(l => l.toLowerCase() === nom.toLowerCase())) return
    const { error } = await supabase
      .from('lieux_selles')
      .upsert([{ nom, user_id: user.id }], { onConflict: 'user_id,nom', ignoreDuplicates: true })
    if (!error) setLieux(l => [...l, nom].sort((a, b) => a.localeCompare(b, 'fr')))
  }

  return { lieux, ensureLieu }
}
