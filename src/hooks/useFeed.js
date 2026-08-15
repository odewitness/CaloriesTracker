import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { computeTotals } from '../lib/nutrients'

const REACTION_TABLE = { recette: 'reactions_partages', journal: 'reactions_journal' }
const COMMENT_TABLE = { recette: 'commentaires_partages', journal: 'commentaires_journal' }
const POST_TABLE = { recette: 'partages_recettes', journal: 'partages_journal' }

// ─────────────────────────────────────────────────────────────────────────────
// useFeed — fil des partages (recettes + journées/repas), déjà filtré côté
// base par RLS (une utilisatrice ne reçoit que ses propres partages + ceux
// de ses amies acceptées) : pas de filtre .eq('user_id', ...) à ajouter côté
// client. Chaque partage porte un champ `_type` ('recette' | 'journal') qui
// pilote à la fois la carte affichée (PartageCard / JournalPartageCard) et
// la table à utiliser pour ses réactions/commentaires/suppression.
// ─────────────────────────────────────────────────────────────────────────────
export function useFeed() {
  const { user } = useAuth()
  const [partages, setPartages] = useState([])
  const [reactionsByPartage, setReactionsByPartage] = useState({})
  const [commentCounts, setCommentCounts] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setPartages([]); setReactionsByPartage({}); setCommentCounts({}); setLoading(false); return }
    setLoading(true)
    const [{ data: recettes }, { data: journal }] = await Promise.all([
      supabase.from('partages_recettes').select('*'),
      supabase.from('partages_journal').select('*'),
    ])
    const rows = [
      ...(recettes || []).map(p => ({ ...p, _type: 'recette' })),
      ...(journal || []).map(p => ({ ...p, _type: 'journal' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setPartages(rows)

    const recetteIds = rows.filter(r => r._type === 'recette').map(r => r.id)
    const journalIds = rows.filter(r => r._type === 'journal').map(r => r.id)

    if (recetteIds.length === 0 && journalIds.length === 0) {
      setReactionsByPartage({})
      setCommentCounts({})
      setLoading(false)
      return
    }

    const [reactRecette, commRecette, reactJournal, commJournal] = await Promise.all([
      recetteIds.length > 0 ? supabase.from('reactions_partages').select('*').in('partage_id', recetteIds) : Promise.resolve({ data: [] }),
      recetteIds.length > 0 ? supabase.from('commentaires_partages').select('partage_id').in('partage_id', recetteIds) : Promise.resolve({ data: [] }),
      journalIds.length > 0 ? supabase.from('reactions_journal').select('*').in('partage_id', journalIds) : Promise.resolve({ data: [] }),
      journalIds.length > 0 ? supabase.from('commentaires_journal').select('partage_id').in('partage_id', journalIds) : Promise.resolve({ data: [] }),
    ])

    const rGrouped = {}
    for (const r of [...(reactRecette.data || []), ...(reactJournal.data || [])]) {
      if (!rGrouped[r.partage_id]) rGrouped[r.partage_id] = []
      rGrouped[r.partage_id].push(r)
    }
    const cCounts = {}
    for (const c of [...(commRecette.data || []), ...(commJournal.data || [])]) {
      cCounts[c.partage_id] = (cCounts[c.partage_id] || 0) + 1
    }
    setReactionsByPartage(rGrouped)
    setCommentCounts(cCounts)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Snapshot de la recette au moment du partage — ingredients au format
  // { food_name, food_source, food_ref_id, qty_g, energie_kcal, proteines,
  // glucides, lipides, fibres } (déjà l'échelle de base de la recette, cf.
  // RecipesSection). food_source/food_ref_id permettent, pour les
  // ingrédients Ciqual/OFF (bases publiques), de recharger le détail complet
  // des micronutriments lors d'un "Ajouter à mes recettes" par une amie —
  // voir addToMyRecipes dans SocialPage.jsx.
  const shareRecette = async ({ recette, ingredients, message }) => {
    if (!user) return { error: 'Non connecté' }
    const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()

    const payload = {
      auteur_id: user.id,
      auteur_pseudo: myProfile?.pseudo || null,
      auteur_prenom: myProfile?.prenom || null,
      recette_id: recette.id,
      nom: recette.nom,
      portions: recette.portions || 1,
      poids_cru_g: recette.poids_cru_g || null,
      poids_cuit_g: recette.poids_cuit_g || null,
      tare_g: recette.tare_g || null,
      categories: recette.categories || [],
      instructions: recette.instructions?.trim() || null,
      temps_preparation_min: recette.temps_preparation_min || null,
      temps_cuisson_min: recette.temps_cuisson_min || null,
      temps_repos_min: recette.temps_repos_min || null,
      energie_kcal: recette.energie_kcal ?? null,
      proteines: recette.proteines ?? null,
      glucides: recette.glucides ?? null,
      lipides: recette.lipides ?? null,
      fibres: recette.fibres ?? null,
      sel: recette.sel ?? null,
      sucres: recette.sucres ?? null,
      acides_gras_satures: recette.acides_gras_satures ?? null,
      message: message?.trim() || null,
    }

    const { data: partage, error } = await supabase.from('partages_recettes').insert(payload).select().single()
    if (error) return { error }

    if (ingredients?.length > 0) {
      const rows = ingredients.map((ing, idx) => ({
        partage_id: partage.id,
        food_name: ing.food_name,
        food_source: ing.food_source || null,
        food_ref_id: ing.food_ref_id || null,
        qty_g: ing.qty_g,
        energie_kcal: ing.energie_kcal ?? null,
        proteines: ing.proteines ?? null,
        glucides: ing.glucides ?? null,
        lipides: ing.lipides ?? null,
        fibres: ing.fibres ?? null,
        ordre: idx,
      }))
      const { error: ingError } = await supabase.from('partage_recette_ingredients').insert(rows)
      if (ingError) return { error: ingError }
    }

    await load()
    return { data: partage, error: null }
  }

  // Partage d'une journée entière (meal = null) ou d'un seul repas (meal =
  // 'Petit-déjeuner'/'Déjeuner'/'Dîner'/'Collation'). Les totaux sont
  // toujours inclus ; le détail aliment par aliment n'est snapshotté que si
  // includeDetail est vrai (choix de l'utilisatrice au moment du partage).
  const shareJournal = async ({ date, meal, entries, includeDetail, message }) => {
    if (!user) return { error: 'Non connecté' }
    const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
    const totals = computeTotals(entries)

    const payload = {
      auteur_id: user.id,
      auteur_pseudo: myProfile?.pseudo || null,
      auteur_prenom: myProfile?.prenom || null,
      date,
      meal: meal || null,
      include_detail: !!includeDetail,
      energie_kcal: totals.kcal,
      proteines: totals.prot,
      glucides: totals.gluc,
      lipides: totals.lip,
      fibres: totals.fib,
      message: message?.trim() || null,
    }

    const { data: partage, error } = await supabase.from('partages_journal').insert(payload).select().single()
    if (error) return { error }

    if (includeDetail && entries?.length > 0) {
      const rows = entries.map((e, idx) => ({
        partage_id: partage.id,
        meal: e.meal,
        food_name: e.food_name,
        qty_g: e.qty_g,
        energie_kcal: e.energie_kcal ?? null,
        proteines: e.proteines ?? null,
        glucides: e.glucides ?? null,
        lipides: e.lipides ?? null,
        fibres: e.fibres ?? null,
        ordre: idx,
      }))
      const { error: alimError } = await supabase.from('partage_journal_aliments').insert(rows)
      if (alimError) return { error: alimError }
    }

    await load()
    return { data: partage, error: null }
  }

  // partage = ligne du fil (avec _type) — les deux containers de détail
  // passent { id, _type } directement puisqu'ils connaissent déjà leur type.
  const deletePartage = async (partage) => {
    const table = POST_TABLE[partage._type]
    const { error } = await supabase.from(table).delete().eq('id', partage.id)
    if (!error) setPartages(p => p.filter(x => x.id !== partage.id))
    return { error }
  }

  // Toggle réaction directement depuis le fil (sans ouvrir le détail).
  const toggleReaction = async (partage, emoji) => {
    if (!user) return
    const table = REACTION_TABLE[partage._type]
    const current = reactionsByPartage[partage.id] || []
    const mine = current.find(r => r.emoji === emoji && r.user_id === user.id)
    if (mine) {
      const { error } = await supabase.from(table).delete().eq('id', mine.id)
      if (!error) setReactionsByPartage(prev => ({ ...prev, [partage.id]: (prev[partage.id] || []).filter(r => r.id !== mine.id) }))
    } else {
      const { data: myProfile } = await supabase.from('profiles').select('pseudo, prenom').eq('id', user.id).single()
      const { data, error } = await supabase
        .from(table)
        .insert({ partage_id: partage.id, user_id: user.id, emoji, user_pseudo: myProfile?.pseudo || null, user_prenom: myProfile?.prenom || null })
        .select()
        .single()
      if (!error && data) setReactionsByPartage(prev => ({ ...prev, [partage.id]: [...(prev[partage.id] || []), data] }))
    }
  }

  return { partages, reactionsByPartage, commentCounts, loading, shareRecette, shareJournal, deletePartage, toggleReaction, refetch: load }
}

export { REACTION_TABLE, COMMENT_TABLE, POST_TABLE }
