import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { EXPLORER_SELECT } from '../lib/ciqualExplorer'

// ─────────────────────────────────────────────────────────────────────────────
// useCiqualCatalog — charge une fois la table `ciqual` en projection allégée
// (voir EXPLORER_SELECT) pour que l'explorateur puisse trier/filtrer en mémoire
// sans aller-retour réseau à chaque réglage.
//
// Le cache est au niveau du MODULE, pas du composant : `ciqual` est une base de
// référence statique (elle ne bouge qu'à un ré-import ANSES), donc rouvrir la
// page dans la même session ne redéclenche aucune requête.
//
// PostgREST plafonne les réponses (1000 lignes par défaut) : on pagine avec
// .range() jusqu'à recevoir une page incomplète. `order('id')` garantit que la
// pagination est stable — sans ordre explicite, deux pages peuvent se
// chevaucher ou sauter des lignes.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000
let cachedFoods = null

export function useCiqualCatalog() {
  const [foods, setFoods] = useState(cachedFoods || [])
  const [loading, setLoading] = useState(!cachedFoods)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (cachedFoods) return
    let cancelled = false

    ;(async () => {
      const all = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: err } = await supabase
          .from('ciqual')
          .select(EXPLORER_SELECT)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

        if (err) {
          console.error('useCiqualCatalog error:', err)
          if (!cancelled) { setError(err); setLoading(false) }
          return
        }
        all.push(...(data || []))
        if (!data || data.length < PAGE_SIZE) break
      }

      cachedFoods = all
      if (!cancelled) { setFoods(all); setLoading(false) }
    })()

    return () => { cancelled = true }
  }, [])

  return { foods, loading, error }
}

// Met à jour les portions d'un aliment dans le cache module, après une
// sauvegarde réussie depuis ExplorerFoodModal ou FoodPicker (édition des
// "portions courantes" d'un aliment ciqual). Le cache vit en dehors du cycle
// de vie des composants : sans ce patch, la modification resterait invisible
// dans l'explorateur tant que la session (ou la page) n'est pas rechargée.
export function patchCachedPortions(alimCode, portions) {
  if (!cachedFoods) return
  const idx = cachedFoods.findIndex(f => f.alim_code === alimCode)
  if (idx !== -1) cachedFoods[idx] = { ...cachedFoods[idx], portions }
}
