import React, { forwardRef, useImperativeHandle, useState, useMemo } from 'react'
import { ChevronDown, Trash2, Share2, Pencil, X, Search, ArrowUpDown, UtensilsCrossed, MoreVertical, Clock } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import { useFeed } from '../hooks/useFeed'
import RecipeFormModal from './RecipeFormModal'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import RecipePhoto from './RecipePhoto'
import PlanMealModal from './PlanMealModal'
import SortModal from './SortModal'
import AddToJournalSheet from './AddToJournalSheet'
import ShareRecipeModal from './ShareRecipeModal'
import { getRecipeCategoryIcon, getRecipeCategoryColor } from '../lib/categoryIcons'
import { todayStr } from '../lib/dates'
import {
  DEFAULT_SORT, sortRecettes, describeSortField, isCustomSort,
  filterByCategories, filterBySeasons, filterByTimeRanges, isCustomFilter, describeActiveFilters,
  PREP_TIME_RANGES, COOK_TIME_RANGES, REST_TIME_RANGES,
} from '../lib/recipeSort'
import { RECIPE_CATEGORIES, UNCATEGORIZED_LABEL } from '../lib/recipeCategories'
import { getSeasonIcon } from '../lib/seasons'
import { getNutriBadge } from '../lib/nutriBadge'
import MacroPillsRow from './MacroPillsRow'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// RecipeCard — carte d'une recette dans la liste
// ─────────────────────────────────────────────────────────────────────────────
function RecipeCard({ recette, ingredients, onOpen, onEdit, onDelete, onShare }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasIngredients = ingredients && ingredients.length > 0

  const portions        = recette.portions || 1
  const poidsRef         = recette.poids_cuit_g || recette.poids_cru_g || null
  const poidsParPortion  = poidsRef ? poidsRef / portions : null
  const factor           = poidsParPortion ? poidsParPortion / 100 : null

  const totalTempsMin = (recette.temps_preparation_min || 0) + (recette.temps_cuisson_min || 0) + (recette.temps_repos_min || 0)
  const badge = getNutriBadge(recette)

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        {recette.photo_updated_at && (
          <div style={{ width: 44, flexShrink: 0, cursor: 'pointer' }} onClick={() => onOpen(recette)}>
            <RecipePhoto recetteId={recette.id} version={recette.photo_updated_at} ratio="1 / 1" radius={9} />
          </div>
        )}
        <span
          style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => onOpen(recette)}
        >
          {recette.nom}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, position: 'relative' }}>
          {hasIngredients && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
              className="btn-icon"
              style={{ color: 'var(--text-hint)' }}
            >
              <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
            className="btn-icon"
            style={{ color: 'var(--text-hint)' }}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
              <div className="card" style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, padding: 4, minWidth: 150 }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(recette) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Pencil size={14} /> Modifier
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onShare(recette) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Share2 size={14} /> Partager
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(recette.id) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div onClick={() => onOpen(recette)} style={{ cursor: 'pointer' }}>
        {/* ── Chips catégorie / saison / temps / badge nutritionnel ── */}
        {(recette.categories?.length > 0 || recette.saisons?.length > 0 || totalTempsMin > 0 || badge) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {recette.categories?.length > 0 && (
              <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
                {recette.categories.map(c => `${getRecipeCategoryIcon(c)} ${c}`).join(', ')}
              </span>
            )}
            {recette.saisons?.length > 0 && (
              <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
                {recette.saisons.map(s => `${getSeasonIcon(s)} ${s}`).join(', ')}
              </span>
            )}
            {totalTempsMin > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-hint)', fontSize: 11, fontWeight: 600 }}>
                <Clock size={11} />{totalTempsMin} min
              </span>
            )}
            {badge && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: badge.bg, color: badge.color, borderRadius: 20, padding: '2px 9px 2px 7px', fontSize: 10.5, fontWeight: 700 }}>
                {badge.emoji} {badge.label}
              </span>
            )}
          </div>
        )}

        {/* ── Macros en pastilles ── */}
        {recette.energie_kcal == null ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun ingrédient</div>
        ) : (
          <>
            <MacroPillsRow
              label="100 g" labelColor="var(--text-hint)" bg="var(--gray-bg)"
              kcal={recette.energie_kcal} kcalColor="var(--text)"
              proteines={recette.proteines || 0} glucides={recette.glucides || 0} lipides={recette.lipides || 0}
              marginBottom={factor != null ? 6 : 0}
            />
            {factor != null && (
              <MacroPillsRow
                label="Portion" labelColor="var(--green-dark)" bg="var(--green-light)"
                kcal={recette.energie_kcal * factor} kcalColor="var(--green-dark)"
                proteines={(recette.proteines || 0) * factor} glucides={(recette.glucides || 0) * factor} lipides={(recette.lipides || 0) * factor}
              />
            )}
          </>
        )}
      </div>

      {/* ── Liste ingrédients + grammage (dépliable) ── */}
      {expanded && hasIngredients && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          {ingredients.map((ing, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 8,
                fontSize: 12, color: 'var(--text-muted)', padding: '3px 0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</span>
              <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text)' }}>{ing.qty_g} g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper pour charger ingrédients + afficher RecipeFormModal en édition
// ─────────────────────────────────────────────────────────────────────────────
function RecipeEditWrapper({ recette, onSaved, onClose }) {
  const { ingredients, loading } = useRecetteDetail(recette.id)
  if (loading) return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32 }} />
        <h2>Chargement...</h2>
        <button className="btn-icon" onClick={() => window.history.back()}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <Loader />
    </div>
  )
  return <RecipeFormModal recette={recette} ingredients={ingredients} onSaved={onSaved} onClose={onClose} />
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipesSection — contenu de l'onglet "Recettes" dans ManualPage.
// La liste n'est affichée que quand `active` (onglet actif), mais les modals
// (nouvelle/détail/édition recette, planification, tri) restent montées
// indépendamment de l'onglet actif — même comportement qu'avant l'extraction.
// openNew() est exposée via ref pour le menu "Nouveau" partagé (ManualPage).
// ─────────────────────────────────────────────────────────────────────────────
const RecipesSection = forwardRef(function RecipesSection({ active }, ref) {
  const toast = useToast()
  const { user } = useAuth()
  const { recettes, ingredientsByRecette, loading: loadingRecettes, deleteRecette, refetch: refetchRecettes } = useRecipes()
  const { shareRecette } = useFeed()
  const [recipeSearch, setRecipeSearch] = useState('')

  // Normalise pour une recherche insensible à la casse et aux accents
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  const filteredRecettes = useMemo(() => {
    const q = normalize(recipeSearch.trim())
    if (!q) return recettes
    return recettes.filter(r => {
      if (normalize(r.nom).includes(q)) return true
      const ings = ingredientsByRecette[r.id] || []
      return ings.some(ing => normalize(ing.food_name).includes(q))
    })
  }, [recettes, ingredientsByRecette, recipeSearch])

  // ── Tri + filtre des recettes ─────────────────────────────────────────────
  const [recipeSort, setRecipeSort] = useState(DEFAULT_SORT)
  const [sortModalOpen, setSortModalOpen] = useState(false)

  const recipeSortActive   = isCustomSort(recipeSort)
  const recipeFilterActive = isCustomFilter(recipeSort)

  // Regroupées par catégorie (une recette avec plusieurs catégories apparaît
  // dans chaque groupe correspondant). "Sans catégorie" n'apparaît que quand
  // aucun filtre n'est actif — filtrer par catégorie exclut naturellement les
  // recettes qui n'en ont aucune.
  const groupedRecettes = useMemo(() => {
    let timeFiltered = filterByCategories(filteredRecettes, recipeSort.categories)
    timeFiltered = filterBySeasons(timeFiltered, recipeSort.saisons)
    timeFiltered = filterByTimeRanges(timeFiltered, 'temps_preparation_min', recipeSort.prepRanges, PREP_TIME_RANGES)
    timeFiltered = filterByTimeRanges(timeFiltered, 'temps_cuisson_min',     recipeSort.cookRanges, COOK_TIME_RANGES)
    timeFiltered = filterByTimeRanges(timeFiltered, 'temps_repos_min',       recipeSort.restRanges, REST_TIME_RANGES)
    const sorted = sortRecettes(timeFiltered, recipeSort)
    const groups = []
    for (const cat of RECIPE_CATEGORIES) {
      if (recipeSort.categories.length > 0 && !recipeSort.categories.includes(cat)) continue
      const items = sorted.filter(r => (r.categories || []).includes(cat))
      if (items.length > 0) groups.push({ key: cat, items })
    }
    if (recipeSort.categories.length === 0) {
      const items = sorted.filter(r => !(r.categories || []).length)
      if (items.length > 0) groups.push({ key: UNCATEGORIZED_LABEL, items })
    }
    return groups
  }, [filteredRecettes, recipeSort])

  const totalRecettesCount = groupedRecettes.reduce((s, g) => s + g.items.length, 0)

  // ── Plier/déplier chaque groupe de catégorie (déplié par défaut) ─────────
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set())
  const toggleCategoryCollapsed = (key) =>
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const [recipeModal, setRecipeModal] = useState(null) // null | { type: 'new' | 'edit' | 'detail', recette? }
  const [planTarget, setPlanTarget] = useState(null) // preset source { nom, items, sourceType, sourceId } en cours de planification
  const [shareTarget, setShareTarget] = useState(null) // { recette, ingredients } | null

  // Depuis la carte (liste), on n'a que food_name/qty_g en mémoire
  // (ingredientsByRecette) — on recharge les ingrédients complets (macros)
  // juste avant d'ouvrir la modale de partage.
  const handleShareFromCard = async (recette) => {
    const { data } = await supabase.from('recette_ingredients').select('*').eq('recette_id', recette.id).eq('user_id', user.id)
    setShareTarget({ recette, ingredients: data || [] })
  }

  const confirmShare = async (message) => {
    const { error } = await shareRecette({ recette: shareTarget.recette, ingredients: shareTarget.ingredients, message })
    if (!error) toast('✓ Recette partagée avec tes amies !')
    else toast('Erreur lors du partage')
    setShareTarget(null)
  }

  // ── "Ajouter au journal" depuis le détail d'une recette ───────────────────
  const [addToJournalTarget, setAddToJournalTarget] = useState(null) // { nom, items } | null
  const [journalDate, setJournalDate] = useState(todayStr())
  const [journalMeal, setJournalMeal] = useState('Déjeuner')

  const handleAddToJournal = (items, recette) => {
    setJournalDate(todayStr())
    setAddToJournalTarget({ nom: recette.nom, items })
  }

  const confirmAddToJournal = async () => {
    if (!addToJournalTarget) return
    const rows = addToJournalTarget.items.map(item => ({ ...item, date: journalDate, meal: journalMeal, user_id: user.id }))
    const { error } = await supabase.from('journal').insert(rows)
    if (!error) toast(`✓ ${addToJournalTarget.nom} ajouté au journal !`)
    else toast('Erreur')
    setAddToJournalTarget(null)
  }

  useImperativeHandle(ref, () => ({ openNew: () => setRecipeModal({ type: 'new' }) }))

  return (
    <>
      {active && (
        <>
          {/* ── Barre de recherche + tri ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder="Rechercher une recette ou un ingrédient..."
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                style={{ paddingLeft: 36, paddingRight: recipeSearch ? 36 : 12 }}
              />
              {recipeSearch && (
                <button
                  onClick={() => setRecipeSearch('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              onClick={() => setSortModalOpen(true)}
              style={{
                width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: (recipeSortActive || recipeFilterActive) ? 'var(--green-light)' : 'var(--gray-bg)',
                color: (recipeSortActive || recipeFilterActive) ? 'var(--green-dark)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <ArrowUpDown size={17} />
            </button>
          </div>

          {(recipeSortActive || recipeFilterActive) && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 10 }}>
              {recipeFilterActive && `Filtré par ${describeActiveFilters(recipeSort).join(', ')}`}
              {recipeFilterActive && recipeSortActive && ' · '}
              {recipeSortActive && `Trié par ${describeSortField(recipeSort.primary, recipeSort.basis)}${recipeSort.secondary ? `, puis ${describeSortField(recipeSort.secondary, recipeSort.basis)}` : ''}`}
            </div>
          )}

          {loadingRecettes && <Loader />}

          {!loadingRecettes && totalRecettesCount === 0 && (
            <EmptyState
              icon={<UtensilsCrossed size={40} />}
              title={recipeSearch || recipeFilterActive ? 'Aucun résultat' : 'Aucune recette'}
              description={recipeSearch || recipeFilterActive
                ? "Aucune recette ne correspond à ta recherche/filtre"
                : "Crée ta première recette pour calculer les calories de tes plats maison"}
            />
          )}

          {groupedRecettes.map(({ key, items }) => {
            const collapsed = collapsedCategories.has(key)
            const { accent, bg } = getRecipeCategoryColor(key)
            return (
              <div key={key} style={{ marginBottom: 18 }}>
                <button
                  onClick={() => toggleCategoryCollapsed(key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: collapsed ? 0 : 6 }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: bg, color: accent, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                      {getRecipeCategoryIcon(key)} {key}
                    </span>
                    <span style={{ color: 'var(--text-hint)', fontSize: 12, fontWeight: 600 }}>({items.length})</span>
                  </span>
                  <ChevronDown size={16} color="var(--text-hint)" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {!collapsed && items.map(r => (
                  <RecipeCard
                    key={r.id}
                    recette={r}
                    ingredients={ingredientsByRecette[r.id]}
                    onOpen={(rec) => setRecipeModal({ type: 'detail', recette: rec })}
                    onEdit={(rec) => setRecipeModal({ type: 'edit', recette: rec })}
                    onDelete={async (id) => { await deleteRecette(id); toast('Supprimé') }}
                    onShare={handleShareFromCard}
                  />
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* ── Modals recettes ── */}

      {/* Nouvelle recette */}
      {recipeModal?.type === 'new' && (
        <RecipeFormModal
          recette={null}
          ingredients={[]}
          onSaved={() => { setRecipeModal(null); refetchRecettes() }}
          onClose={() => setRecipeModal(null)}
        />
      )}

      {/* Détail recette */}
      {recipeModal?.type === 'detail' && recipeModal.recette && (
        <RecipeDetailWrapper
          recetteId={recipeModal.recette.id}
          initialRecette={recipeModal.recette}
          onEdit={() => setRecipeModal({ type: 'edit', recette: recipeModal.recette })}
          onDelete={async () => {
            await deleteRecette(recipeModal.recette.id)
            toast('Recette supprimée')
            setRecipeModal(null)
          }}
          onClose={() => setRecipeModal(null)}
          onShare={(recette, ingredients) => setShareTarget({ recette, ingredients })}
          onPlan={setPlanTarget}
          onAddToJournal={handleAddToJournal}
        />
      )}

      {/* ── Partager une recette avec ses amies ── */}
      {shareTarget && (
        <ShareRecipeModal
          recette={shareTarget.recette}
          onConfirm={confirmShare}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* ── Ajouter au journal (recette) ── */}
      {addToJournalTarget && (
        <AddToJournalSheet
          nom={addToJournalTarget.nom}
          journalDate={journalDate}
          onDateChange={setJournalDate}
          journalMeal={journalMeal}
          onMealChange={setJournalMeal}
          onConfirm={confirmAddToJournal}
          onClose={() => setAddToJournalTarget(null)}
        />
      )}

      {/* ── Planifier (recette) ── */}
      {planTarget && (
        <PlanMealModal
          presetSource={planTarget}
          onClose={() => setPlanTarget(null)}
          onPlanned={() => setPlanTarget(null)}
        />
      )}

      {/* Édition recette */}
      {recipeModal?.type === 'edit' && recipeModal.recette && (
        <RecipeEditWrapper
          recette={recipeModal.recette}
          onSaved={() => { setRecipeModal(null); refetchRecettes() }}
          onClose={() => setRecipeModal(null)}
        />
      )}

      {/* ── Tri des recettes ── */}
      {sortModalOpen && (
        <SortModal
          value={recipeSort}
          onChange={setRecipeSort}
          onClose={() => setSortModalOpen(false)}
        />
      )}
    </>
  )
})

export default RecipesSection
