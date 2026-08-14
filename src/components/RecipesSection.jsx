import React, { forwardRef, useImperativeHandle, useState, useMemo } from 'react'
import { ChevronDown, Trash2, X, Search, ArrowUpDown, UtensilsCrossed } from 'lucide-react'
import { useToast } from '../lib/toast'
import { useRecipes, useRecetteDetail } from '../hooks/useRecipes'
import RecipeFormModal from './RecipeFormModal'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import PlanMealModal from './PlanMealModal'
import SortModal from './SortModal'
import {
  DEFAULT_SORT, sortRecettes, describeSortField, isCustomSort,
  filterByCategories, filterByTimeRanges, isCustomFilter, describeActiveFilters,
  PREP_TIME_RANGES, COOK_TIME_RANGES, REST_TIME_RANGES,
} from '../lib/recipeSort'
import { RECIPE_CATEGORIES, UNCATEGORIZED_LABEL } from '../lib/recipeCategories'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// RecipeCard — carte d'une recette dans la liste
// ─────────────────────────────────────────────────────────────────────────────
function RecipeCard({ recette, ingredients, onOpen, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasIngredients = ingredients && ingredients.length > 0

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => onOpen(recette)}
        >
          <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recette.nom}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {recette.energie_kcal != null ? `${Math.round(recette.energie_kcal)} kcal/100g` : 'Aucun ingrédient'}
            {recette.portions > 1 && <span style={{ marginLeft: 6, color: 'var(--text-hint)' }}>· {recette.portions} portions</span>}
            {recette.poids_cuit_g && <span style={{ marginLeft: 6, color: 'var(--blue)', fontSize: 11 }}>⚖️ pesé</span>}
          </div>

          {recette.energie_kcal != null && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              <span className="c-prot">P {Math.round(recette.proteines || 0)}g</span>&nbsp;
              <span className="c-gluc">G {Math.round(recette.glucides  || 0)}g</span>&nbsp;
              <span className="c-lip">L {Math.round(recette.lipides   || 0)}g</span>
              <span style={{ color: 'var(--text-hint)' }}> /100g</span>
            </div>
          )}

          {(() => {
            const portions       = recette.portions || 1
            const poidsRef        = recette.poids_cuit_g || recette.poids_cru_g || null
            const poidsParPortion = poidsRef ? poidsRef / portions : null
            const factor          = poidsParPortion ? poidsParPortion / 100 : null
            if (recette.energie_kcal == null || factor == null) return null
            return (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {Math.round(recette.energie_kcal * factor)} kcal&nbsp;·&nbsp;
                <span className="c-prot">P {Math.round((recette.proteines || 0) * factor)}g</span>&nbsp;
                <span className="c-gluc">G {Math.round((recette.glucides  || 0) * factor)}g</span>&nbsp;
                <span className="c-lip">L {Math.round((recette.lipides   || 0) * factor)}g</span>
                <span style={{ color: 'var(--text-hint)' }}> /portion ({Math.round(poidsParPortion)}g)</span>
              </div>
            )
          })()}
        </div>

        {/* ── Toggle ingrédients ── */}
        {hasIngredients && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
            className="btn-icon"
            style={{ color: 'var(--text-hint)', flexShrink: 0 }}
          >
            <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}
        <button
          className="btn-icon"
          onClick={e => { e.stopPropagation(); onDelete(recette.id) }}
          style={{ color: 'var(--text-hint)', flexShrink: 0 }}
        >
          <Trash2 size={16} />
        </button>
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
  const { recettes, ingredientsByRecette, loading: loadingRecettes, deleteRecette, refetch: refetchRecettes } = useRecipes()
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
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <button
                  onClick={() => toggleCategoryCollapsed(key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: collapsed ? 0 : 6 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {key} <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>({items.length})</span>
                  </span>
                  <ChevronDown size={16} color="var(--text-hint)" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {!collapsed && items.map(r => (
                  <RecipeCard
                    key={r.id}
                    recette={r}
                    ingredients={ingredientsByRecette[r.id]}
                    onOpen={(rec) => setRecipeModal({ type: 'detail', recette: rec })}
                    onDelete={async (id) => { await deleteRecette(id); toast('Supprimé') }}
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
          onEdit={() => setRecipeModal({ type: 'edit', recette: recipeModal.recette })}
          onDelete={async () => {
            await deleteRecette(recipeModal.recette.id)
            toast('Recette supprimée')
            setRecipeModal(null)
          }}
          onClose={() => setRecipeModal(null)}
          onPlan={setPlanTarget}
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
