import React, { useMemo, useState } from 'react'
import { X, Search, ArrowUpDown, ChevronDown, Plus, Clock, UtensilsCrossed } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { recipePortionMacros, templateServingMacros } from '../lib/mealPlanner'
import { getNutriBadge } from '../lib/nutriBadge'
import { getRecipeCategoryIcon, getRecipeCategoryColor } from '../lib/categoryIcons'
import { RECIPE_CATEGORIES, UNCATEGORIZED_LABEL } from '../lib/recipeCategories'
import { getSeasonIcon } from '../lib/seasons'
import * as recipeSortLib from '../lib/recipeSort'
import * as templateSortLib from '../lib/mealTemplateSort'
import SortModal from './SortModal'
import MealTemplateSortModal from './MealTemplateSortModal'
import MacroPillsRow from './MacroPillsRow'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// BatchSourcePicker — sélecteur plein écran des recettes / repas types à
// ajouter à « Ma fournée ». Même logique de recherche, tri, filtre et
// regroupement par catégorie que « Mes aliments » (onglets Recettes et Repas
// types), avec des cartes cochables affichant les macros d'une portion et un
// total de la sélection en pied de page.
//
// Props : recettes, ingredientsByRecette, repasTypes, loading, excludeKeys
// (Set de 'recette:<id>' / 'repas_type:<id>' déjà dans la fournée),
// onAdd(sources), onClose()
// ─────────────────────────────────────────────────────────────────────────────

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const keyOf = (kind, id) => `${kind}:${id}`

const chipStyle = { background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }

// Macros d'UNE portion d'une source, ou null si non calculables.
function portionMacrosOf(kind, entity) {
  return kind === 'recette' ? recipePortionMacros(entity) : templateServingMacros(entity)
}

function SourceCard({ kind, entity, ingredients, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const macros = portionMacrosOf(kind, entity)
  const isRecipe = kind === 'recette'

  const totalTempsMin = isRecipe
    ? (entity.temps_preparation_min || 0) + (entity.temps_cuisson_min || 0) + (entity.temps_repos_min || 0)
    : 0
  const badge = macros ? getNutriBadge({ energie_kcal: macros.kcal, proteines: macros.prot, glucides: macros.gluc, lipides: macros.lip, fibres: macros.fibres }) : null
  const parts = isRecipe ? (entity.portions || 1) : (entity.nb_portions || 1)
  const hasList = ingredients && ingredients.length > 0

  return (
    <div
      className="card"
      style={{
        marginBottom: 8, padding: '11px 12px', borderRadius: 16,
        border: `1.5px solid ${selected ? 'var(--green)' : 'transparent'}`,
        background: selected ? 'var(--green-light)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Sélectionner ${entity.nom}`}
          style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }}
        />
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggle}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{entity.nom}</div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isRecipe && <span style={chipStyle}>repas type</span>}
            {entity.saisons?.length > 0 && (
              <span style={chipStyle}>{entity.saisons.map(s => `${getSeasonIcon(s)} ${s}`).join(', ')}</span>
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

          {macros ? (
            <MacroPillsRow
              label="Portion" labelColor="var(--green-dark)" bg={selected ? 'var(--white)' : 'var(--green-light)'}
              kcal={macros.kcal} kcalColor="var(--green-dark)"
              proteines={macros.prot} glucides={macros.gluc} lipides={macros.lip}
              hint={parts > 1 ? `1/${parts}` : undefined}
            />
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isRecipe ? 'Poids de la recette non renseigné' : 'Aucun aliment'}
            </div>
          )}
        </div>
        {hasList && (
          <button
            onClick={() => setExpanded(x => !x)}
            className="btn-icon"
            aria-label={expanded ? 'Masquer le détail' : 'Voir le détail'}
            style={{ color: 'var(--text-hint)', flexShrink: 0 }}
          >
            <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}
      </div>

      {expanded && hasList && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</span>
              <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text)' }}>{ing.qty_g} g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BatchSourcePicker({ recettes, ingredientsByRecette, repasTypes, loading, excludeKeys, onAdd, onClose }) {
  useBackButton(onClose)
  const [tab, setTab] = useState('recette') // 'recette' | 'repas_type'
  const [search, setSearch] = useState('')
  const [recipeSort, setRecipeSort] = useState(recipeSortLib.DEFAULT_SORT)
  const [templateSort, setTemplateSort] = useState(templateSortLib.DEFAULT_SORT)
  const [sortOpen, setSortOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [sel, setSel] = useState(() => new Map()) // keyOf(kind, id) → { id, nom, kind, macros }
  const [adding, setAdding] = useState(false)

  const isRecipeTab = tab === 'recette'
  const sort = isRecipeTab ? recipeSort : templateSort
  const lib = isRecipeTab ? recipeSortLib : templateSortLib
  const sortActive = lib.isCustomSort(sort)
  const filterActive = lib.isCustomFilter(sort)

  // Sources pas encore dans la fournée, par type.
  const availableRecettes = useMemo(() => recettes.filter(r => !excludeKeys.has(keyOf('recette', r.id))), [recettes, excludeKeys])
  const availableTemplates = useMemo(() => repasTypes.filter(t => !excludeKeys.has(keyOf('repas_type', t.id))), [repasTypes, excludeKeys])

  const groups = useMemo(() => {
    const q = normalize(search.trim())
    let list = isRecipeTab ? availableRecettes : availableTemplates
    if (q) {
      list = list.filter(x => {
        if (normalize(x.nom).includes(q)) return true
        const ings = isRecipeTab ? (ingredientsByRecette[x.id] || []) : (x.items || [])
        return ings.some(ing => normalize(ing.food_name).includes(q))
      })
    }
    list = lib.filterBySeasons(lib.filterByCategories(list, sort.categories), sort.saisons)
    if (isRecipeTab) {
      list = recipeSortLib.filterByTimeRanges(list, 'temps_preparation_min', sort.prepRanges, recipeSortLib.PREP_TIME_RANGES)
      list = recipeSortLib.filterByTimeRanges(list, 'temps_cuisson_min', sort.cookRanges, recipeSortLib.COOK_TIME_RANGES)
      list = recipeSortLib.filterByTimeRanges(list, 'temps_repos_min', sort.restRanges, recipeSortLib.REST_TIME_RANGES)
    }
    const sorted = isRecipeTab ? recipeSortLib.sortRecettes(list, sort) : templateSortLib.sortMealTemplates(list, sort)
    const out = []
    for (const cat of RECIPE_CATEGORIES) {
      if (sort.categories.length > 0 && !sort.categories.includes(cat)) continue
      const items = sorted.filter(x => (x.categories || []).includes(cat))
      if (items.length > 0) out.push({ key: cat, items })
    }
    if (sort.categories.length === 0) {
      const items = sorted.filter(x => !(x.categories || []).length)
      if (items.length > 0) out.push({ key: UNCATEGORIZED_LABEL, items })
    }
    return out
  }, [isRecipeTab, availableRecettes, availableTemplates, ingredientsByRecette, search, sort, lib])

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0)
  const kind = tab

  const toggle = (entity) => setSel(prev => {
    const next = new Map(prev)
    const k = keyOf(kind, entity.id)
    if (next.has(k)) next.delete(k)
    else next.set(k, { id: entity.id, nom: entity.nom, kind, macros: portionMacrosOf(kind, entity) })
    return next
  })

  const toggleCollapsed = (key) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // Total d'UNE portion de chaque source cochée (les portions à préparer se
  // règlent ensuite dans la fournée).
  const selTotal = useMemo(() => {
    let kcal = 0, prot = 0
    for (const s of sel.values()) { kcal += s.macros?.kcal || 0; prot += s.macros?.prot || 0 }
    return { kcal, prot }
  }, [sel])

  const confirm = async () => {
    if (!sel.size || adding) return
    setAdding(true)
    await onAdd([...sel.values()].map(({ id, nom, kind: k }) => ({ id, nom, kind: k })))
    setAdding(false)
  }

  const tabButton = (key, label, count) => (
    <button
      onClick={() => setTab(key)}
      style={{
        flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', border: 'none',
        background: tab === key ? 'var(--white)' : 'transparent',
        color: tab === key ? 'var(--text)' : 'var(--text-muted)',
        boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {label} <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}>({count})</span>
    </button>
  )

  const selectedInOtherTab = [...sel.values()].filter(s => s.kind !== kind).length

  return (
    <>
      <div className="page-modal" style={{ zIndex: 65 }}>
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Ajouter à la fournée</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={20} color="var(--text-muted)" /></button>
        </div>

        <div className="page-modal-body" style={{ paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: 'var(--gray-bg)', marginBottom: 12 }}>
            {tabButton('recette', 'Recettes', availableRecettes.length)}
            {tabButton('repas_type', 'Repas types', availableTemplates.length)}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder={isRecipeTab ? 'Rechercher une recette ou un ingrédient...' : 'Rechercher un repas type ou un aliment...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, paddingRight: search ? 36 : 12 }}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Effacer la recherche" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setSortOpen(true)}
              aria-label="Trier & filtrer"
              style={{
                width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: (sortActive || filterActive) ? 'var(--green-light)' : 'var(--gray-bg)',
                color: (sortActive || filterActive) ? 'var(--green-dark)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}
            >
              <ArrowUpDown size={17} />
            </button>
          </div>

          {(sortActive || filterActive) && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 10 }}>
              {filterActive && `Filtré par ${lib.describeActiveFilters(sort).join(', ')}`}
              {filterActive && sortActive && ' · '}
              {sortActive && `Trié par ${lib.describeSortField(sort.primary, sort.basis)}${sort.secondary ? `, puis ${lib.describeSortField(sort.secondary, sort.basis)}` : ''}`}
            </div>
          )}

          {loading && <Loader />}

          {!loading && totalCount === 0 && (
            <EmptyState
              icon={<UtensilsCrossed size={40} />}
              title={search || filterActive ? 'Aucun résultat' : 'Rien à ajouter'}
              description={search || filterActive
                ? `Aucun${isRecipeTab ? 'e recette' : ' repas type'} ne correspond à ta recherche/filtre`
                : (isRecipeTab ? recettes : repasTypes).length === 0
                  ? `Tu n’as pas encore ${isRecipeTab ? 'de recette' : 'de repas type'}.`
                  : 'Tout est déjà dans la fournée.'}
            />
          )}

          {groups.map(({ key, items }) => {
            const isCollapsed = collapsed.has(key)
            const { accent, bg } = getRecipeCategoryColor(key)
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <button
                  onClick={() => toggleCollapsed(key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px', marginBottom: isCollapsed ? 0 : 6 }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: bg, color: accent, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                      {getRecipeCategoryIcon(key)} {key}
                    </span>
                    <span style={{ color: 'var(--text-hint)', fontSize: 12, fontWeight: 600 }}>({items.length})</span>
                  </span>
                  <ChevronDown size={16} color="var(--text-hint)" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {!isCollapsed && items.map(x => (
                  <SourceCard
                    key={x.id}
                    kind={kind}
                    entity={x}
                    ingredients={isRecipeTab ? ingredientsByRecette[x.id] : x.items}
                    selected={sel.has(keyOf(kind, x.id))}
                    onToggle={() => toggle(x)}
                  />
                ))}
              </div>
            )
          })}
        </div>

        {/* ── Pied de page : total de la sélection + validation ── */}
        <div style={{ flexShrink: 0, padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--border)', background: 'var(--white)' }}>
          {sel.size > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
              <strong style={{ color: 'var(--text)' }}>{sel.size}</strong> sélectionné{sel.size > 1 ? 's' : ''}
              {selectedInOtherTab > 0 && ` (dont ${selectedInOtherTab} dans l’autre onglet)`}
              {' · '}1 portion de chacun ≈ <strong style={{ color: 'var(--text)' }}>{Math.round(selTotal.kcal)} kcal</strong>
              {' · '}<strong style={{ color: 'var(--text)' }}>{Math.round(selTotal.prot)} g</strong> de protéines
            </div>
          )}
          <button
            onClick={confirm}
            disabled={!sel.size || adding}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !sel.size || adding ? 0.5 : 1 }}
          >
            <Plus size={16} /> {adding ? 'Ajout…' : `Ajouter${sel.size ? ` (${sel.size})` : ''} à la fournée`}
          </button>
        </div>
      </div>

      {sortOpen && (isRecipeTab ? (
        <SortModal value={recipeSort} onChange={setRecipeSort} onClose={() => setSortOpen(false)} />
      ) : (
        <MealTemplateSortModal value={templateSort} onChange={setTemplateSort} onClose={() => setSortOpen(false)} />
      ))}
    </>
  )
}
