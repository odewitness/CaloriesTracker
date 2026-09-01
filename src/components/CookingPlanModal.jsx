import React, { useEffect, useMemo, useState } from 'react'
import { X, ChevronUp, ChevronDown, RefreshCw, ListChecks, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useBackButton } from '../hooks/useBackButton'
import { useBatchCooking } from '../hooks/useBatchCooking'
import { useBatchCookingSteps } from '../hooks/useBatchCookingSteps'
import { useRecipes } from '../hooks/useRecipes'
import { useMealTemplatesList } from '../hooks/useMealTemplates'
import { useToast } from '../lib/toast'
import { parseInstructionSteps, annotateInstructionSteps } from '../lib/recipeInstructions'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// CookingPlanModal — « Plan de cuisine » de Ma fournée (roadmap §M9).
// On met bout à bout TOUTES les étapes d'instructions des recettes de la
// fournée (parseInstructionSteps), l'utilisatrice les réorganise dans l'ordre
// où elle veut cuisiner et les coche au fur et à mesure. Chaque étape porte le
// nom de sa recette (badge de couleur). Les grammages des ingrédients sont
// ré-injectés dans le texte comme sur une fiche recette (annotateInstruction-
// Steps), à l'échelle des portions à préparer de la fournée. Ingrédients par
// recette listés dans un panneau dépliable.
//
// Données propres : table batch_cooking_steps (useBatchCookingSteps).
// Props : onClose()
// ─────────────────────────────────────────────────────────────────────────────

const RECIPE_BADGES = [
  { bg: 'var(--green-light)',  fg: 'var(--green-dark)' },
  { bg: 'var(--blue-light)',   fg: 'var(--blue-dark)' },
  { bg: 'var(--amber-light)',  fg: 'var(--amber)' },
  { bg: 'var(--purple-light)', fg: 'var(--purple)' },
  { bg: 'var(--coral-light)',  fg: 'var(--coral)' },
]

function r0(n) { return Math.round(n || 0) }

export default function CookingPlanModal({ onClose, semaine }) {
  useBackButton(onClose)
  const { user } = useAuth()
  const toast = useToast()
  const { items: fourneeItems, loading: loadingF } = useBatchCooking(semaine)
  const { recettes, loading: loadingR } = useRecipes()
  const { repasTypes, loading: loadingT } = useMealTemplatesList()
  const { steps, loading: loadingS, generate, toggleFait, move } = useBatchCookingSteps(semaine)

  const [ingByRecette, setIngByRecette] = useState({})
  const [loadingIng, setLoadingIng] = useState(true)
  const [showIngredients, setShowIngredients] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Éléments de la fournée qui existent encore, dans l'ordre de la fournée
  // (recettes ET repas types). `kind` = 'recette' | 'repas_type'.
  const planSources = useMemo(() => fourneeItems
    .map(it => {
      if (it.recette_id) {
        const rec = recettes.find(r => r.id === it.recette_id)
        return rec && { item: it, kind: 'recette', entity: rec }
      }
      if (it.repas_type_id) {
        const tpl = repasTypes.find(t => t.id === it.repas_type_id)
        return tpl && { item: it, kind: 'repas_type', entity: tpl }
      }
      return null
    })
    .filter(Boolean), [fourneeItems, recettes, repasTypes])

  // Sous-ensemble recettes (seules à porter des instructions → des étapes).
  const planRecipes = useMemo(
    () => planSources.filter(s => s.kind === 'recette').map(s => ({ item: s.item, rec: s.entity })),
    [planSources],
  )

  const recipeIdsKey = planRecipes.map(x => x.rec.id).join(',')

  // Ingrédients de toutes ces recettes, en une requête.
  useEffect(() => {
    if (!user || !recipeIdsKey) { setIngByRecette({}); setLoadingIng(false); return }
    let cancelled = false
    setLoadingIng(true)
    ;(async () => {
      const { data } = await supabase
        .from('recette_ingredients')
        .select('*')
        .in('recette_id', recipeIdsKey.split(','))
        .eq('user_id', user.id)
      if (cancelled) return
      const by = {}
      for (const r of data || []) (by[r.recette_id] = by[r.recette_id] || []).push(r)
      setIngByRecette(by)
      setLoadingIng(false)
    })()
    return () => { cancelled = true }
  }, [user, recipeIdsKey])

  // Couleur de badge stable par élément (recette OU repas type), sur l'ordre
  // de la fournée.
  const badgeIndex = useMemo(() => {
    const m = {}
    planSources.forEach((s, i) => { m[`${s.kind}:${s.entity.id}`] = i % RECIPE_BADGES.length })
    return m
  }, [planSources])

  const wantPortions = (source) => {
    const want = Number(source.item.portions)
    return want > 0 ? want : (source.kind === 'recette' ? source.entity.portions : source.entity.nb_portions) || 1
  }

  // Ingrédients d'un élément, mis à l'échelle des portions à préparer :
  //   - recette : lignes recette_ingredients (× portions / recette.portions) ;
  //   - repas type : ses `items` inline (× portions / nb_portions).
  const scaledIngredients = (source) => {
    const want = Number(source.item.portions)
    if (source.kind === 'recette') {
      const base = source.entity.portions || 1
      const f = want > 0 ? want / base : 1
      return (ingByRecette[source.entity.id] || []).map(i => ({ food_name: i.food_name, qty_g: (Number(i.qty_g) || 0) * f }))
    }
    const base = source.entity.nb_portions || 1
    const f = want > 0 ? want / base : 1
    return (source.entity.items || []).map(i => ({ food_name: i.food_name, qty_g: (Number(i.qty_g) || 0) * f }))
  }

  // Map "texte d'étape brut → segments annotés" par recette (les repas types
  // n'ont pas d'instructions → pas d'étapes).
  const meta = useMemo(() => {
    const byId = {}
    planRecipes.forEach(({ rec }) => {
      const source = planSources.find(s => s.kind === 'recette' && s.entity.id === rec.id)
      const rawSteps = parseInstructionSteps(rec.instructions)
      const segs = annotateInstructionSteps(rawSteps, source ? scaledIngredients(source) : [])
      const map = new Map()
      rawSteps.forEach((s, i) => map.set(s, segs[i]))
      byId[rec.id] = { badge: RECIPE_BADGES[badgeIndex[`recette:${rec.id}`] ?? 0], annotated: map }
    })
    return byId
  }, [planRecipes, planSources, ingByRecette, badgeIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recettes de la fournée sans aucune instruction saisie (ne contribuent
  // aucune étape).
  const recipesWithoutSteps = useMemo(
    () => planRecipes.filter(({ rec }) => parseInstructionSteps(rec.instructions).length === 0).map(x => x.rec.nom),
    [planRecipes],
  )

  const orderedSteps = useMemo(() => [...steps].sort((a, b) => a.ordre - b.ordre), [steps])
  const doneCount = orderedSteps.filter(s => s.fait).length
  const pct = orderedSteps.length ? Math.round((doneCount / orderedSteps.length) * 100) : 0

  const loading = loadingF || loadingR || loadingT || loadingS

  const handleGenerate = async () => {
    setBusy(true)
    const flat = []
    for (const { rec } of planRecipes) {
      for (const s of parseInstructionSteps(rec.instructions)) {
        flat.push({ recette_id: rec.id, recette_nom: rec.nom, texte: s })
      }
    }
    const { error } = await generate(flat)
    setBusy(false)
    setConfirmRegen(false)
    if (error) { toast('Erreur'); return }
    if (!flat.length) toast('Aucune de tes recettes n’a d’instructions saisies')
  }

  const segmentsFor = (step) => meta[step.recette_id]?.annotated.get(step.texte) || [{ text: step.texte }]
  const badgeFor = (step) => meta[step.recette_id]?.badge || RECIPE_BADGES[0]

  return (
    <div className="page-modal" style={{ zIndex: 70 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Plan de cuisine</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        {loading ? (
          <Loader />
        ) : planSources.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={28} />}
            title="Rien à cuisiner pour l’instant"
            description="Ajoute d’abord des recettes ou repas types à Ma fournée."
          />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
              Toutes les étapes de tes recettes, bout à bout. Réorganise-les dans l’ordre où tu veux
              cuisiner avec les flèches, coche au fur et à mesure. Chaque étape garde la couleur de
              sa recette.
            </div>

            {recipesWithoutSteps.length > 0 && (
              <div className="card" style={{ padding: '9px 12px', marginBottom: 12, background: 'var(--amber-light)', border: 'none', display: 'flex', gap: 7, fontSize: 11.5, color: 'var(--amber)', fontWeight: 600 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Pas d’instructions saisies pour : {recipesWithoutSteps.join(', ')}. Ajoute-les dans la recette (une action par ligne) pour qu’elles apparaissent ici.</span>
              </div>
            )}

            {/* Ingrédients par élément (dépliable) */}
            <button
              onClick={() => setShowIngredients(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'space-between', background: 'var(--gray-bg)', border: 'none', borderRadius: 8, padding: '9px 12px', marginBottom: 10, fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}
            >
              Ingrédients
              <ChevronDown size={15} style={{ transform: showIngredients ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {showIngredients && (
              <div style={{ marginBottom: 12 }}>
                {loadingIng ? <Loader /> : planSources.map((source) => {
                  const badge = RECIPE_BADGES[badgeIndex[`${source.kind}:${source.entity.id}`] ?? 0]
                  const ings = scaledIngredients(source)
                  const want = wantPortions(source)
                  return (
                    <div key={`${source.kind}:${source.entity.id}`} className="card" style={{ padding: '10px 12px', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ background: badge.bg, color: badge.fg, borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{source.entity.nom}</span>
                        {source.kind === 'repas_type' && <span style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>repas type</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>pour {want} portion{want > 1 ? 's' : ''}</span>
                      </div>
                      {ings.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
                      ) : ings.map((i, k) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.food_name}</span>
                          <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--text)' }}>{r0(i.qty_g)} g</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {planRecipes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-hint)', textAlign: 'center', padding: '8px 0' }}>
                Aucune recette avec des étapes dans la fournée (les repas types n’en ont pas).
              </div>
            ) : orderedSteps.length === 0 ? (
              <div style={{ textAlign: 'center' }}>
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}
                >
                  <ListChecks size={16} /> {busy ? 'Génération…' : 'Générer le plan de cuisine'}
                </button>
              </div>
            ) : (
              <>
                <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 12.5, fontWeight: 700 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Avancement</span>
                    <span style={{ color: 'var(--green-dark)' }}>{doneCount} / {orderedSteps.length}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-bg)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', transition: 'width .2s' }} />
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {orderedSteps.map((step, idx) => {
                    const badge = badgeFor(step)
                    return (
                      <div
                        key={step.id}
                        className="card"
                        style={{ display: 'flex', gap: 8, padding: '9px 10px', marginBottom: 6, alignItems: 'flex-start' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                          <button className="btn-icon" style={{ width: 24, height: 22 }} disabled={idx === 0} onClick={() => move(step.id, -1)} aria-label="Monter l’étape">
                            <ChevronUp size={14} color={idx === 0 ? 'var(--border)' : 'var(--text-muted)'} />
                          </button>
                          <button className="btn-icon" style={{ width: 24, height: 22 }} disabled={idx === orderedSteps.length - 1} onClick={() => move(step.id, 1)} aria-label="Descendre l’étape">
                            <ChevronDown size={14} color={idx === orderedSteps.length - 1 ? 'var(--border)' : 'var(--text-muted)'} />
                          </button>
                        </div>
                        <input
                          type="checkbox"
                          checked={step.fait}
                          onChange={e => toggleFait(step.id, e.target.checked)}
                          style={{ width: 17, height: 17, flexShrink: 0, marginTop: 3 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'inline-block', background: badge.bg, color: badge.fg, borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                            {step.recette_nom}
                          </span>
                          <div style={{
                            fontSize: 12.5, lineHeight: 1.45,
                            color: step.fait ? 'var(--text-hint)' : 'var(--text)',
                            textDecoration: step.fait ? 'line-through' : 'none',
                          }}>
                            {segmentsFor(step).map((seg, i) => seg.highlight
                              ? <strong key={i} style={{ color: 'var(--green-dark)' }}>{seg.text}</strong>
                              : <React.Fragment key={i}>{seg.text}</React.Fragment>)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {confirmRegen ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Réinitialiser l’ordre et les cases ?</span>
                    <button onClick={handleGenerate} disabled={busy} style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}>
                      {busy ? 'Génération…' : 'Régénérer'}
                    </button>
                    <button onClick={() => setConfirmRegen(false)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-hint)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}>
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRegen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
                  >
                    <RefreshCw size={13} /> Régénérer depuis les recettes
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
