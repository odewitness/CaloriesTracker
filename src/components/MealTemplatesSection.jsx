import React, { forwardRef, useImperativeHandle, useState, useEffect, useMemo } from 'react'
import { Trash2, ChevronDown, Check, Pencil, UtensilsCrossed, CalendarPlus, MoreVertical, Search, X, ArrowUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import AddFoodModal from './AddFoodModal'
import PlanMealModal from './PlanMealModal'
import EditMealTemplatePage from './EditMealTemplatePage'
import AddToJournalSheet from './AddToJournalSheet'
import MealTemplateSortModal from './MealTemplateSortModal'
import { saveMealTemplate, deleteMealTemplate } from '../hooks/useMealTemplates'
import { getNutriBadge } from '../lib/nutriBadge'
import { todayStr } from '../lib/dates'
import { getRecipeCategoryIcon, getRecipeCategoryColor } from '../lib/categoryIcons'
import { RECIPE_CATEGORIES, UNCATEGORIZED_LABEL } from '../lib/recipeCategories'
import {
  DEFAULT_SORT, sortMealTemplates, describeSortField, isCustomSort,
  filterByCategories, filterBySeasons, isCustomFilter, describeActiveFilters,
} from '../lib/mealTemplateSort'
import { getSeasonIcon } from '../lib/seasons'
import MacroPillsRow from './MacroPillsRow'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// Ce fichier est l'ex-MealsPage.jsx, extrait pour vivre comme 3e onglet de
// "Mes aliments" (ManualPage) plutôt que comme page indépendante. Toute la
// logique (chargement, sauvegarde, import depuis le journal, ajout au
// journal) est inchangée — seul l'habillage "page complète" a été retiré :
// plus de <div className="page-content"> ni de titre "Mes repas types" en
// double (ManualPage fournit déjà son propre header + le switch d'onglets).
// ─────────────────────────────────────────────────────────────────────────────

// Carte repas type — même habillage que les cartes Aliments/Recettes (rayon
// 16, pastilles de macros, badge nutritionnel), menu "..." pour les actions.
function MealTemplateCard({ repas, onDelete, onEdit, onAddToJournal, onPlan }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const items = repas.items || []
  const hasItems = items.length > 0
  const totalKcal   = items.reduce((s, i) => s + (i.energie_kcal || 0), 0)
  const totalProt   = items.reduce((s, i) => s + (i.proteines || 0), 0)
  const totalGluc   = items.reduce((s, i) => s + (i.glucides || 0), 0)
  const totalLip    = items.reduce((s, i) => s + (i.lipides || 0), 0)
  const totalFibres = items.reduce((s, i) => s + (i.fibres || 0), 0)
  const portions = repas.nb_portions || 1

  const badge = hasItems ? getNutriBadge({ energie_kcal: totalKcal, proteines: totalProt, glucides: totalGluc, lipides: totalLip, fibres: totalFibres }) : null

  return (
    <div className="card" style={{ marginBottom: 10, padding: '13px 14px', borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span
          style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setExpanded(x => !x)}
        >
          {repas.nom}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, position: 'relative' }}>
          {hasItems && (
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
              <div className="card" style={{ position: 'absolute', top: 34, right: 0, zIndex: 10, padding: 4, minWidth: 160 }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(repas) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Pencil size={14} /> Modifier
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onPlan(repas) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--purple, #8b5cf6)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <CalendarPlus size={14} /> Planifier
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(repas.id) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div onClick={() => setExpanded(x => !x)} style={{ cursor: 'pointer' }}>
        {/* ── Chips nombre d'aliments / badge nutritionnel ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
            {items.length} aliment{items.length > 1 ? 's' : ''}
          </span>
          {repas.saisons?.length > 0 && (
            <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
              {repas.saisons.map(s => `${getSeasonIcon(s)} ${s}`).join(', ')}
            </span>
          )}
          {badge && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: badge.bg, color: badge.color, borderRadius: 20, padding: '2px 9px 2px 7px', fontSize: 10.5, fontWeight: 700 }}>
              {badge.emoji} {badge.label}
            </span>
          )}
        </div>

        {repas.description && (
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 10 }}>{repas.description}</div>
        )}

        {/* ── Macros en pastilles, pour la portion renseignée ── */}
        {!hasItems ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun aliment</div>
        ) : (
          <MacroPillsRow
            label="Portion" labelColor="var(--green-dark)" bg="var(--green-light)"
            kcal={totalKcal / portions} kcalColor="var(--green-dark)"
            proteines={totalProt / portions} glucides={totalGluc / portions} lipides={totalLip / portions}
            hint={portions > 1 ? `1/${portions}` : undefined}
          />
        )}
      </div>

      {/* ── Liste des aliments (dépliable) ── */}
      {expanded && hasItems && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', gap: 8,
                fontSize: 12, color: 'var(--text-muted)', padding: '3px 0',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.food_name}</span>
              <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text)' }}>{item.qty_g} g</span>
            </div>
          ))}
          <div style={{ paddingTop: 10 }}>
            <button
              onClick={() => onAddToJournal(repas)}
              style={{ width: '100%', background: 'var(--green)', color: 'white', borderRadius: 9, padding: '11px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Check size={15} /> Ajouter au journal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// MealTemplatesSection — contenu de l'onglet "Repas types" dans ManualPage.
// Pas de <div className="page-content"> ni de gros titre : ManualPage
// fournit déjà le header + le switch d'onglets au-dessus. Toujours monté
// (comme CustomFoodsSection/RecipesSection) — `active` contrôle uniquement
// l'affichage de la liste, pour que openNew() reste appelable depuis le menu
// "Nouveau" partagé même quand cet onglet n'est pas affiché.
// ─────────────────────────────────────────────────────────────────────────────
const MealTemplatesSection = forwardRef(function MealTemplatesSection({ active }, ref) {
  const toast = useToast()
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null) // null = fermé, {} = nouveau, repas = édition
  const [addToJournalTarget, setAddToJournalTarget] = useState(null)
  const [planTarget, setPlanTarget] = useState(null) // repas type en cours de planification
  const [journalDate, setJournalDate] = useState(todayStr())
  const [journalMeal, setJournalMeal] = useState('Déjeuner')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [sortModalOpen, setSortModalOpen] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set())

  useEffect(() => { load() }, [user])

  // Normalise pour une recherche insensible à la casse et aux accents
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  const filteredRepasList = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return repasList
    return repasList.filter(r => {
      if (normalize(r.nom).includes(q)) return true
      return (r.items || []).some(i => normalize(i.food_name).includes(q))
    })
  }, [repasList, search])

  const sortActive   = isCustomSort(sort)
  const filterActive = isCustomFilter(sort)

  // Regroupés par catégorie (un repas type avec plusieurs catégories apparaît
  // dans chaque groupe correspondant) — même logique que RecipesSection.
  const groupedRepas = useMemo(() => {
    const catFiltered = filterBySeasons(filterByCategories(filteredRepasList, sort.categories), sort.saisons)
    const sorted = sortMealTemplates(catFiltered, sort)
    const groups = []
    for (const cat of RECIPE_CATEGORIES) {
      if (sort.categories.length > 0 && !sort.categories.includes(cat)) continue
      const items = sorted.filter(r => (r.categories || []).includes(cat))
      if (items.length > 0) groups.push({ key: cat, items })
    }
    if (sort.categories.length === 0) {
      const items = sorted.filter(r => !(r.categories || []).length)
      if (items.length > 0) groups.push({ key: UNCATEGORIZED_LABEL, items })
    }
    return groups
  }, [filteredRepasList, sort])

  const totalRepasCount = groupedRepas.reduce((s, g) => s + g.items.length, 0)

  const toggleCategoryCollapsed = (key) =>
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const load = async () => {
    if (!user) { setRepasList([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('repas_types').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRepasList(data || [])
    setLoading(false)
  }

  const handleSave = async ({ nom, description, items, nb_portions, categories, saisons }) => {
    const { error } = await saveMealTemplate({ userId: user.id, repasTypeId: editTarget?.id, nom, description, items, nbPortions: nb_portions, categories, saisons })
    if (!error) { toast(editTarget?.id ? '✓ Repas modifié !' : '✓ Repas créé !'); load() }
    else toast('Erreur')
    setEditTarget(null)
  }

  const handleDelete = async (id) => {
    const { error } = await deleteMealTemplate(id, user.id)
    if (!error) { setRepasList(r => r.filter(x => x.id !== id)); toast('Supprimé') }
    else toast('Erreur')
  }

  const handleAddToJournal = async (repas) => {
    setJournalDate(todayStr())
    setAddToJournalTarget(repas)
  }

  const confirmAddToJournal = async () => {
    if (!addToJournalTarget) return
    const rows = addToJournalTarget.items.map(item => ({ ...item, date: journalDate, meal: journalMeal, user_id: user.id }))
    const { error } = await supabase.from('journal').insert(rows)
    if (!error) toast(`✓ ${addToJournalTarget.nom} ajouté au journal !`)
    else toast('Erreur')
    setAddToJournalTarget(null)
  }

  useImperativeHandle(ref, () => ({ openNew: () => setEditTarget({}) }))

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
                placeholder="Rechercher un repas type ou un aliment..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, paddingRight: search ? 36 : 12 }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
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
              {filterActive && `Filtré par ${describeActiveFilters(sort).join(', ')}`}
              {filterActive && sortActive && ' · '}
              {sortActive && `Trié par ${describeSortField(sort.primary, sort.basis)}${sort.secondary ? `, puis ${describeSortField(sort.secondary, sort.basis)}` : ''}`}
            </div>
          )}

          {loading && <Loader />}

          {!loading && totalRepasCount === 0 && (
            <EmptyState
              icon={<UtensilsCrossed size={40} />}
              title={search || filterActive ? 'Aucun résultat' : 'Aucun repas type'}
              description={search || filterActive
                ? 'Aucun repas type ne correspond à ta recherche/filtre'
                : "Crée des groupes d'aliments pour les réutiliser facilement"}
            />
          )}

          {groupedRepas.map(({ key, items }) => {
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
                  <MealTemplateCard
                    key={r.id}
                    repas={r}
                    onDelete={handleDelete}
                    onEdit={setEditTarget}
                    onAddToJournal={handleAddToJournal}
                    onPlan={setPlanTarget}
                  />
                ))}
              </div>
            )
          })}

          {sortModalOpen && (
            <MealTemplateSortModal
              value={sort}
              onChange={setSort}
              onClose={() => setSortModalOpen(false)}
            />
          )}
        </>
      )}

      {editTarget !== null && (
        <EditMealTemplatePage repas={editTarget?.id ? editTarget : null} onSave={handleSave} onClose={() => setEditTarget(null)} />
      )}

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

      {planTarget && (
        <PlanMealModal
          presetSource={{ nom: planTarget.nom, items: planTarget.items || [], sourceType: 'repas_type', sourceId: planTarget.id }}
          onClose={() => setPlanTarget(null)}
          onPlanned={() => setPlanTarget(null)}
        />
      )}
    </>
  )
})

export default MealTemplatesSection
