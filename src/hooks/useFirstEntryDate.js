import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// useFirstEntryDate(tables, { enabled }) — date de la toute première ligne de
// l'utilisatrice dans une ou plusieurs tables (colonne `date`), la plus
// ancienne l'emportant. Sert à borner les stats de l'Historique (onglets
// Digestion et Sommeil) au jour où le suivi a vraiment commencé : les jours
// d'avant ne sont pas des « jours sans », juste des jours pas encore suivis.
//
//   undefined : chargement en cours
//   null      : aucune ligne (ou `enabled` = false)
//   'YYYY-MM-DD'
// ─────────────────────────────────────────────────────────────────────────────
export function useFirstEntryDate(tables, { enabled = true } = {}) {
  const { user } = useAuth()
  const [firstDate, setFirstDate] = useState(undefined)
  const key = tables.join(',')

  useEffect(() => {
    let cancelled = false
    if (!enabled || !user?.id) { setFirstDate(null); return }
    setFirstDate(undefined)
    Promise.all(key.split(',').map(t =>
      supabase.from(t).select('date').eq('user_id', user.id)
        .order('date', { ascending: true }).limit(1),
    )).then(results => {
      if (cancelled) return
      const dates = results.map(r => r.data?.[0]?.date).filter(Boolean).sort()
      setFirstDate(dates[0] || null)
    })
    return () => { cancelled = true }
  }, [enabled, user?.id, key])

  return firstDate
}
