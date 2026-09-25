import React, { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2, ChefHat, Check, ChevronRight, ListChecks, History } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useBatchCooking } from '../hooks/useBatchCooking'
import { useRecipes } from '../hooks/useRecipes'
import { useMealTemplatesList } from '../hooks/useMealTemplates'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../lib/toast'
import { addDaysStr } from '../lib/mealPlannerApply'
import { recipePortionMacros, templateServingMacros } from '../lib/mealPlanner'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import MealTemplateDetailWrapper from './MealTemplateDetailWrapper'
import CookingPlanModal from './CookingPlanModal'
import BatchSourcePicker from './BatchSourcePicker'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// BatchCookingModal — page « Ma fournée » (roadmap §M9). Check-list des
// recettes ET repas types à cuisiner pour une semaine, cochables « faite / à
// faire », indépendante du planificateur (données propres dans
// batch_cooking_items, voir useBatchCooking). Ouverte depuis Calendrier →
// Menus.
//
// Props : onClose(), semaine (lundi 'YYYY-MM-DD')
// ─────────────────────────────────────────────────────────────────────────────

const keyOf = (kind, id) => `${kind}:${id}`

export default function BatchCookingModal({ onClose, semaine }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const toast = useToast()
  const { items, loading, addSources, toggleFait, setPortions, removeItem, clearDone } = useBatchCooking(semaine)
  const { recettes, ingredientsByRecette, loading: loadingRecipes } = useRecipes()
  const { repasTypes, loading: loadingTemplates } = useMealTemplatesList()
  const { settings } = useSettings()
  const [picking, setPicking] = useState(false)
  const [detail, setDetail] = useState(null) // { kind, entity, portions } | null
  const [planOpen, setPlanOpen] = useState(false)

  const loadingSources = loadingRecipes || loadingTemplates
  const recetteById = useMemo(() => new Map(recettes.map(r => [r.id, r])), [recettes])
  const templateById = useMemo(() => new Map(repasTypes.map(t => [t.id, t])), [repasTypes])

  // Reprendre ce qui restait « à faire » la semaine précédente : proposé
  // seulement quand la fournée de cette semaine est vide, pour ne pas
  // ressusciter à répétition des recettes déjà traitées entre-temps.
  const prevSemaine = useMemo(() => semaine ? addDaysStr(semaine, -7) : null, [semaine])
  const [prevItems, setPrevItems] = useState([])
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [carrying, setCarrying] = useState(false)
  useEffect(() => {
    if (!user || !prevSemaine || loading || items.length > 0) { setPrevItems([]); return }
    let cancelled = false
    setLoadingPrev(true)
    ;(async () => {
      const { data } = await supabase
        .from('batch_cooking_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('semaine', prevSemaine)
        .eq('fait', false)
      if (!cancelled) { setPrevItems(data || []); setLoadingPrev(false) }
    })()
    return () => { cancelled = true }
  }, [user, prevSemaine, loading, items.length])

  const handleCarryOver = async () => {
    if (!prevItems.length || carrying) return
    setCarrying(true)
    const sources = prevItems.map(i => ({
      id: i.recette_id || i.repas_type_id,
      nom: i.nom,
      kind: i.repas_type_id ? 'repas_type' : 'recette',
      portions: i.portions,
    }))
    const portionsById = Object.fromEntries(sources.filter(s => s.portions != null).map(s => [s.id, s.portions]))
    const { error, added } = await addSources(sources, { portionsById })
    setCarrying(false)
    if (error) { toast('Erreur'); return }
    toast(added ? `✓ ${added} repris de la semaine dernière` : 'Rien à reprendre')
    setPrevItems([])
  }

  const excludeKeys = useMemo(() => new Set(
    items.map(i => i.recette_id ? keyOf('recette', i.recette_id) : (i.repas_type_id ? keyOf('repas_type', i.repas_type_id) : null)).filter(Boolean),
  ), [items])

  // Macros d'une portion, par ligne de la fournée (null si la source a été
  // supprimée ou n'est pas dimensionnable).
  const macrosByItem = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const entity = it.recette_id ? recetteById.get(it.recette_id) : it.repas_type_id ? templateById.get(it.repas_type_id) : null
      const macros = !entity ? null : it.recette_id ? recipePortionMacros(entity) : templateServingMacros(entity)
      m.set(it.id, macros)
    }
    return m
  }, [items, recetteById, templateById])

  // Bilan de la fournée : totaux pour les portions à préparer (1 par défaut si
  // non renseigné), rapportés aux objectifs de la semaine (7 jours).
  const totals = useMemo(() => {
    let kcal = 0, prot = 0, portions = 0, unknownMacros = 0, defaultedPortions = 0
    for (const it of items) {
      const p = it.portions != null && Number(it.portions) > 0 ? Number(it.portions) : 1
      if (it.portions == null) defaultedPortions++
      portions += p
      const macros = macrosByItem.get(it.id)
      if (!macros) { unknownMacros++; continue }
      kcal += macros.kcal * p
      prot += macros.prot * p
    }
    return { kcal, prot, portions, unknownMacros, defaultedPortions }
  }, [items, macrosByItem])

  const weekKcalGoal = (settings.goal_kcal || 0) * 7
  const weekProtGoal = (settings.goal_proteines || 0) * 7

  const doneCount = items.filter(i => i.fait).length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0

  const handleAdd = async (sources) => {
    const { error, added } = await addSources(sources)
    if (error) { toast('Erreur à l’ajout'); return }
    if (added) toast(`✓ ${added} ajouté${added > 1 ? 's' : ''}`)
    setPicking(false)
  }

  const handleClearDone = async () => {
    const { error } = await clearDone()
    if (error) { toast('Erreur'); return }
    toast('Éléments faits retirés')
  }

  return (
    <>
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ma fournée</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
          Tes recettes et repas types à cuisiner cette semaine, à cocher au fur et à mesure. Elle
          vit à part : rien à voir avec un plan de repas généré, tu peux t’en servir seule pour un
          meal prep.
        </div>

        {items.length > 0 && (
          <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)' }}>Avancement</span>
              <span style={{ color: 'var(--green-dark)' }}>{doneCount} / {items.length}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-bg)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', transition: 'width .2s' }} />
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)' }}>Ce que ça représente</span>
              <span style={{ color: 'var(--text-hint)', fontSize: 11.5, fontWeight: 600 }}>
                {totals.portions % 1 === 0 ? totals.portions : totals.portions.toFixed(1)} portion{totals.portions > 1 ? 's' : ''}
              </span>
            </div>
            {[
              { label: 'Calories', value: totals.kcal, goal: weekKcalGoal, unit: 'kcal', color: 'var(--green)' },
              { label: 'Protéines', value: totals.prot, goal: weekProtGoal, unit: 'g', color: 'var(--purple, #8b5cf6)' },
            ].map(row => {
              const share = row.goal > 0 ? Math.round((row.value / row.goal) * 100) : null
              return (
                <div key={row.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>
                      {row.label} : {Math.round(row.value).toLocaleString('fr-FR')} {row.unit}
                      <span style={{ fontWeight: 500, color: 'var(--text-hint)' }}> · ≈ {Math.round(row.value / 7).toLocaleString('fr-FR')} {row.unit}/jour</span>
                    </span>
                    {share != null && <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{share} %</span>}
                  </div>
                  {share != null && (
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, share)}%`, background: row.color, transition: 'width .2s' }} />
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.45 }}>
              Part de tes objectifs de la semaine (7 jours) couverte par cette fournée — le reste
              viendra de tes autres repas.
              {totals.defaultedPortions > 0 && ` ${totals.defaultedPortions} élément${totals.defaultedPortions > 1 ? 's' : ''} sans portions renseignées compte${totals.defaultedPortions > 1 ? 'nt' : ''} pour 1.`}
              {totals.unknownMacros > 0 && ` ${totals.unknownMacros} élément${totals.unknownMacros > 1 ? 's' : ''} sans valeurs nutritionnelles n’${totals.unknownMacros > 1 ? 'ont' : 'a'} pas pu être compté${totals.unknownMacros > 1 ? 's' : ''}.`}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <button
            onClick={() => setPlanOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
              padding: '9px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
              background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            <ListChecks size={15} /> Plan de cuisine
          </button>
        )}

        {loading ? (
          <Loader />
        ) : items.length === 0 ? (
          <>
            <EmptyState
              icon={<ChefHat size={28} />}
              title="Rien dans la fournée"
              description="Ajoute les recettes et repas types que tu comptes préparer."
            />
            {!loadingPrev && prevItems.length > 0 && (
              <button
                onClick={handleCarryOver}
                disabled={carrying}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
                  padding: '10px 12px', marginTop: 4, marginBottom: 12, borderRadius: 'var(--radius-sm)',
                  background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
                  fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', opacity: carrying ? 0.6 : 1,
                }}
              >
                <History size={15} />
                {carrying
                  ? 'Reprise…'
                  : `Reprendre les ${prevItems.length} non fait${prevItems.length > 1 ? 's' : ''} de la semaine dernière`}
              </button>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {items.map(it => {
              const kind = it.recette_id ? 'recette' : (it.repas_type_id ? 'repas_type' : null)
              const entity = kind === 'recette'
                ? recetteById.get(it.recette_id)
                : kind === 'repas_type' ? templateById.get(it.repas_type_id) : null
              return (
              <div
                key={it.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6 }}
              >
                <input
                  type="checkbox"
                  checked={it.fait}
                  onChange={e => toggleFait(it.id, e.target.checked)}
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                {entity ? (
                  <button
                    onClick={() => setDetail({ kind, entity, portions: it.portions })}
                    style={{
                      width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font)',
                      fontSize: 13, fontWeight: 600, textAlign: 'left',
                      color: it.fait ? 'var(--text-hint)' : 'var(--text)',
                      textDecoration: it.fait ? 'line-through' : 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.nom}
                      {kind === 'repas_type' && <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}> · repas type</span>}
                    </span>
                    <ChevronRight size={13} style={{ flexShrink: 0, color: 'var(--text-hint)' }} />
                  </button>
                ) : (
                  <span
                    style={{
                      display: 'block', fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: loadingSources && !it.fait ? 'var(--text)' : 'var(--text-hint)',
                      textDecoration: it.fait ? 'line-through' : 'none',
                    }}
                    title={loadingSources ? undefined : 'Élément supprimé'}
                  >
                    {it.nom}
                  </span>
                )}
                {macrosByItem.get(it.id) && (() => {
                  const m = macrosByItem.get(it.id)
                  const p = it.portions != null && Number(it.portions) > 1 ? Number(it.portions) : null
                  return (
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2, opacity: it.fait ? 0.6 : 1 }}>
                      {Math.round(m.kcal)} kcal · {Math.round(m.prot)} g P /portion
                      {p && <> · <strong style={{ color: 'var(--text-muted)' }}>{Math.round(m.kcal * p)} kcal au total</strong></>}
                    </div>
                  )
                })()}
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  defaultValue={it.portions ?? ''}
                  onBlur={e => {
                    const v = e.target.value
                    if (String(it.portions ?? '') !== v) setPortions(it.id, v)
                  }}
                  placeholder="—"
                  aria-label={`Portions à préparer pour ${it.nom}`}
                  style={{
                    width: 44, flexShrink: 0, textAlign: 'center', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 6, padding: '4px 2px',
                    fontFamily: 'var(--font)', background: 'var(--white)', color: 'var(--text)',
                  }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-hint)', flexShrink: 0 }}>portions</span>
                <button
                  onClick={() => removeItem(it.id)}
                  className="btn-icon"
                  aria-label={`Retirer ${it.nom}`}
                  style={{ width: 26, height: 26, flexShrink: 0, color: 'var(--text-hint)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              )
            })}
          </div>
        )}

        <button
          onClick={() => setPicking(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Plus size={16} /> Ajouter recettes / repas types
        </button>

        {doneCount > 0 && (
          <button
            onClick={handleClearDone}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
          >
            <Check size={13} /> Retirer les {doneCount} fait{doneCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>

    {detail?.kind === 'recette' && (
      <RecipeDetailWrapper
        recetteId={detail.entity.id}
        initialRecette={detail.entity}
        initialPortions={detail.portions}
        onClose={() => setDetail(null)}
      />
    )}
    {detail?.kind === 'repas_type' && (
      <MealTemplateDetailWrapper
        repasTypeId={detail.entity.id}
        onClose={() => setDetail(null)}
      />
    )}

    {planOpen && <CookingPlanModal semaine={semaine} onClose={() => setPlanOpen(false)} />}

    {picking && (
      <BatchSourcePicker
        recettes={recettes}
        ingredientsByRecette={ingredientsByRecette}
        repasTypes={repasTypes}
        loading={loadingSources}
        excludeKeys={excludeKeys}
        onAdd={handleAdd}
        onClose={() => setPicking(false)}
      />
    )}
    </>
  )
}
