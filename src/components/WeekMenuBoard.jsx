import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CornerUpLeft, Plus, Check, Trash2, Wand2, ChefHat, Pencil, MoreVertical } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { MEALS_ORDER } from '../lib/nutrients'
import { deviationLevel } from '../lib/mealPlanner'
import { deletePlannedMeal, deletePlannedMeals } from '../hooks/usePlannedMeals'
import { fmt } from '../lib/dates'
import { readAppliedPlans } from '../lib/mealPlannerApply'
import PlanMealModal from './PlanMealModal'
import MealPlannerModal from './MealPlannerModal'
import BatchCookingModal from './BatchCookingModal'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import MealTemplateDetailWrapper from './MealTemplateDetailWrapper'

// ─────────────────────────────────────────────────────────────────────────────
// WeekMenuBoard (roadmap §M5) — plateau de menus de la semaine : 7 jours
// empilés (lisible sur mobile, contrairement à une grille 7×4). Chaque jour
// n'affiche que ses repas remplis + un lien « Ajouter un repas » qui ouvre le
// choix du créneau. On ouvre la fiche recette / repas type en cliquant sur un
// plat, on le retire via le menu ⋮. C'est une autre entrée sur les mêmes
// données que le calendrier (repas_planifies), pas un stockage à part.
//
// Props :
//   anchorDate     — Date quelque part dans la semaine affichée
//   plannedByDate  — { 'YYYY-MM-DD': [repas_planifies] } (fourni par CalendarPage)
//   settings       — pour meal_enabled (quels repas afficher)
//   onChangeWeek(dir) / onGoToday() — navigation (undefined si déjà la semaine en cours)
//   onRefetch()    — à appeler après toute modif (recharge le calendrier)
// ─────────────────────────────────────────────────────────────────────────────

function startOfWeek(d) {
  const r = new Date(d)
  const weekday = (r.getDay() + 6) % 7 // 0 = lundi
  r.setDate(r.getDate() - weekday)
  r.setHours(0, 0, 0, 0)
  return r
}

const LEVEL_COLOR = { ok: 'var(--green-dark)', warn: 'var(--amber)', off: 'var(--coral)' }
// Étiquette courte du repas devant les plats d'une journée.
const MEAL_SHORT = { 'Petit-déjeuner': 'Petit-déj', 'Déjeuner': 'Déjeuner', 'Collation': 'Collation', 'Dîner': 'Dîner' }

function rangeLabel(days) {
  const a = new Date(days[0] + 'T12:00:00')
  const b = new Date(days[6] + 'T12:00:00')
  const sameMonth = a.getMonth() === b.getMonth()
  const fa = a.toLocaleDateString('fr-FR', { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) })
  const fb = b.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${fa} – ${fb}`
}

export default function WeekMenuBoard({ anchorDate, plannedByDate, settings, onChangeWeek, onGoToday, onRefetch }) {
  const { user } = useAuth()
  const toast = useToast()
  const [planSlot, setPlanSlot] = useState(null)   // { date: 'YYYY-MM-DD', meal } | null
  const [menuFor, setMenuFor] = useState(null)     // repas.id dont le petit menu d'actions est ouvert
  const [addFor, setAddFor] = useState(null)       // dateStr dont le menu « ajouter un repas » est ouvert
  const [sourceDetail, setSourceDetail] = useState(null) // { source_type, source_id } du plat dont on ouvre la fiche
  const [busyId, setBusyId] = useState(null)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  // Plans générés appliqués (stashés en localStorage par MealPlannerModal).
  const [appliedPlans, setAppliedPlans] = useState(() => readAppliedPlans())
  const [removingPlan, setRemovingPlan] = useState(false)

  const appliedGroupIds = useMemo(() => new Set(appliedPlans.map(p => p.groupId)), [appliedPlans])

  // Re-lit le stash à la fermeture de la modale du planificateur.
  useEffect(() => {
    if (!plannerOpen) setAppliedPlans(readAppliedPlans())
  }, [plannerOpen])

  const todayStr = fmt(new Date())

  const days = useMemo(() => {
    const s = startOfWeek(anchorDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s)
      d.setDate(d.getDate() + i)
      return fmt(d)
    })
  }, [anchorDate])

  const enabledMeals = useMemo(
    () => MEALS_ORDER.filter(m => settings?.meal_enabled?.[m] !== false),
    [settings?.meal_enabled],
  )
  // Seuls les vrais repas (pas les « Compléments », planifiés à l'avance et
  // sans calcul kcal) comptent dans le plateau et le résumé.
  const mealSet = useMemo(() => new Set(enabledMeals), [enabledMeals])

  // Cible calorique d'une journée (objectif global) + résumé de la semaine
  // affichée : repas planifiés / créneaux, moyenne kcal des jours PLANIFIÉS
  // (on ne compte pas les jours encore vides ni les compléments).
  const dayKcalTarget = Math.round(settings?.goal_kcal || 0)
  const weekStats = useMemo(() => {
    let planned = 0
    let kcal = 0
    let plannedDays = 0
    for (const dateStr of days) {
      const rows = (plannedByDate?.[dateStr] || []).filter(r => mealSet.has(r.meal))
      if (rows.length) plannedDays++
      for (const r of rows) {
        planned++
        kcal += (r.items || []).reduce((s, i) => s + (i.energie_kcal || 0), 0)
      }
    }
    return {
      planned,
      slots: enabledMeals.length * 7,
      plannedDays,
      avgKcal: plannedDays ? Math.round(kcal / plannedDays) : 0,
    }
  }, [days, plannedByDate, enabledMeals.length, mealSet])

  // Lignes de la semaine affichée qui appartiennent à un plan généré par le
  // planificateur (recurrence_group_id présent dans le stash).
  const weekPlanRows = useMemo(() => {
    if (!appliedGroupIds.size) return []
    return days
      .flatMap(d => plannedByDate?.[d] || [])
      .filter(r => r.recurrence_group_id && appliedGroupIds.has(r.recurrence_group_id))
  }, [days, plannedByDate, appliedGroupIds])

  const hasWeekPlan = weekPlanRows.length > 0
  // Entrée de stash du plan appliqué sur CETTE semaine (pour rouvrir le plan
  // enregistré correspondant à l'édition).
  const weekAppliedPlan = useMemo(
    () => appliedPlans.find(p => weekPlanRows.some(r => r.recurrence_group_id === p.groupId)) || null,
    [appliedPlans, weekPlanRows],
  )

  const handleRemovePlan = async () => {
    if (!weekPlanRows.length) return
    setRemovingPlan(true)
    const { error } = await deletePlannedMeals(weekPlanRows.map(r => r.id), user.id)
    setRemovingPlan(false)
    if (error) { toast('Erreur'); return }
    toast('Plan retiré de cette semaine')
    onRefetch()
  }

  const handleDelete = async (repas) => {
    setBusyId(repas.id)
    const { error } = await deletePlannedMeal(repas.id, user.id)
    setBusyId(null)
    setMenuFor(null)
    if (error) { toast('Erreur'); return }
    toast('Retiré du planning')
    onRefetch()
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Navigation de semaine */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn-icon" onClick={() => onChangeWeek(-1)} aria-label="Semaine précédente">
          <ChevronLeft size={18} color="var(--text-muted)" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{rangeLabel(days)}</span>
          {onGoToday && (
            <button
              onClick={onGoToday}
              style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', color: 'var(--green-dark)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}
            >
              <CornerUpLeft size={13} /> Cette semaine
            </button>
          )}
        </div>
        <button className="btn-icon" onClick={() => onChangeWeek(1)} aria-label="Semaine suivante">
          <ChevronRight size={18} color="var(--text-muted)" />
        </button>
      </div>

      {/* Résumé de la semaine affichée : jours planifiés + moyenne kcal + barre */}
      {enabledMeals.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {weekStats.plannedDays} jour{weekStats.plannedDays > 1 ? 's' : ''} sur 7
              {weekStats.planned > 0 && (
                <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}> · {weekStats.planned} repas</span>
              )}
            </span>
            {weekStats.avgKcal > 0 && dayKcalTarget > 0 && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: LEVEL_COLOR[deviationLevel(weekStats.avgKcal, dayKcalTarget)] }}>
                ≈ {weekStats.avgKcal} kcal/j
              </span>
            )}
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--gray-bg)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((weekStats.plannedDays / 7) * 100)}%`, height: '100%', background: 'var(--green)', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {/* Barre d'actions sur une ligne. « Générer un plan » disparaît quand la
          semaine en a déjà un (« Modifier mon plan » est alors en bas). */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {!hasWeekPlan && (
          <button
            onClick={() => setPlannerOpen(true)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            <Wand2 size={15} /> Générer un plan
          </button>
        )}
        <button
          onClick={() => setBatchOpen(true)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
          }}
        >
          <ChefHat size={14} /> Ma fournée
        </button>
      </div>

      {enabledMeals.length === 0 && (
        <div className="card" style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: 'var(--text-hint)' }}>
          Aucun repas activé. Active-les depuis Profil pour planifier des menus.
        </div>
      )}

      {enabledMeals.length > 0 && days.map(dateStr => {
        const d = new Date(dateStr + 'T12:00:00')
        const isToday = dateStr === todayStr
        const isPast = dateStr < todayStr
        const byMeal = {}
        for (const r of (plannedByDate?.[dateStr] || [])) {
          (byMeal[r.meal] = byMeal[r.meal] || []).push(r)
        }
        const dayKcal = (plannedByDate?.[dateStr] || [])
          .filter(r => mealSet.has(r.meal))
          .reduce((s, r) => s + (r.items || []).reduce((ss, i) => ss + (i.energie_kcal || 0), 0), 0)

        return (
          <div
            key={dateStr}
            className="card"
            style={{ padding: '10px 12px 6px', marginBottom: 8, opacity: isPast && !isToday ? 0.6 : 1, borderLeft: isToday ? '3px solid var(--green)' : undefined }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                {d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}
                {isToday && <span style={{ color: 'var(--green-dark)', fontWeight: 700 }}> · aujourd'hui</span>}
              </div>
              {dayKcal > 0 && (
                <span style={{
                  fontSize: 11.5, fontWeight: 600,
                  color: dayKcalTarget > 0 ? LEVEL_COLOR[deviationLevel(dayKcal, dayKcalTarget)] : 'var(--text-hint)',
                }}>
                  {Math.round(dayKcal)}{dayKcalTarget > 0 ? ` / ${dayKcalTarget}` : ''} kcal
                </span>
              )}
            </div>

            {enabledMeals.filter(meal => (byMeal[meal] || []).length > 0).map(meal => (
              <div key={meal} style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.3, flexShrink: 0 }}>
                  {MEAL_SHORT[meal] || meal}
                </span>
                {byMeal[meal].map(r => {
                  const kcal = (r.items || []).reduce((s, i) => s + (i.energie_kcal || 0), 0)
                  const hasSource = r.source_type === 'recette' || r.source_type === 'repas_type'
                  return (
                    <span key={r.id} style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch', maxWidth: '100%' }}>
                      <button
                        onClick={() => hasSource && setSourceDetail({ source_type: r.source_type, source_id: r.source_id })}
                        disabled={busyId === r.id}
                        title={hasSource ? 'Voir la fiche' : undefined}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left',
                          background: r.mange ? 'var(--green-light)' : 'var(--gray-bg)',
                          color: r.mange ? 'var(--green-dark)' : 'var(--text)',
                          border: 'none', borderRadius: '7px 0 0 7px', padding: '4px 8px',
                          fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)',
                          cursor: hasSource ? 'pointer' : 'default',
                        }}
                      >
                        {r.mange && <Check size={11} style={{ flexShrink: 0 }} />}
                        <span>{r.nom}</span>
                        {kcal > 0 && <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}>· {Math.round(kcal)}</span>}
                      </button>
                      <button
                        onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                        disabled={busyId === r.id}
                        aria-label="Actions"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          background: r.mange ? 'var(--green-light)' : 'var(--gray-bg)',
                          color: 'var(--text-hint)', border: 'none', borderRadius: '0 7px 7px 0',
                          padding: '0 5px', marginLeft: 1,
                        }}
                      >
                        <MoreVertical size={13} />
                      </button>

                      {menuFor === r.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setMenuFor(null)} />
                          <div className="card" style={{ position: 'absolute', top: 28, right: 0, zIndex: 20, padding: 4, minWidth: 140 }}>
                            <button
                              onClick={() => handleDelete(r)}
                              style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                              <Trash2 size={14} /> Retirer
                            </button>
                          </div>
                        </>
                      )}
                    </span>
                  )
                })}
              </div>
            ))}

            {/* Ajouter un repas sur ce jour (choix du créneau dans un petit menu) */}
            <div style={{ position: 'relative', marginTop: 6 }}>
              <button
                onClick={() => setAddFor(addFor === dateStr ? null : dateStr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
                  color: 'var(--green-dark)', fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font)', padding: '2px 0',
                }}
              >
                <Plus size={13} /> Ajouter un repas
              </button>
              {addFor === dateStr && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setAddFor(null)} />
                  <div className="card" style={{ position: 'absolute', bottom: 24, left: 0, zIndex: 20, padding: 4, minWidth: 160 }}>
                    {enabledMeals.map(meal => (
                      <button
                        key={meal}
                        onClick={() => { setPlanSlot({ date: dateStr, meal }); setAddFor(null) }}
                        style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}
                      >
                        {meal}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* Actions du plan généré — en bas : modifier, puis retirer (action franche). */}
      {hasWeekPlan && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => setPlannerOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
              padding: '11px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            <Pencil size={15} /> Modifier mon plan
          </button>
          <button
            onClick={handleRemovePlan}
            disabled={removingPlan}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
              padding: '11px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--coral)', color: 'var(--white)', border: 'none',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', opacity: removingPlan ? 0.6 : 1,
            }}
          >
            <Trash2 size={15} />
            {removingPlan ? 'Retrait…' : `Retirer le plan généré (${weekPlanRows.length} repas)`}
          </button>
        </div>
      )}

      {planSlot && (
        <PlanMealModal
          kind="repas"
          defaultDate={new Date(planSlot.date + 'T12:00:00')}
          defaultMeal={planSlot.meal}
          onClose={() => setPlanSlot(null)}
          onPlanned={onRefetch}
        />
      )}

      {plannerOpen && (
        <MealPlannerModal
          onClose={() => setPlannerOpen(false)}
          onApplied={onRefetch}
          defaultStartDate={days[0]}
          initialLoadPlanId={weekAppliedPlan?.savedPlanId || null}
          replaceGroupId={weekAppliedPlan?.groupId || null}
          replaceStartDate={weekAppliedPlan?.startDateStr || null}
        />
      )}

      {batchOpen && (
        <BatchCookingModal semaine={days[0]} onClose={() => setBatchOpen(false)} />
      )}

      {/* Fiche de la recette / du repas type ouverte depuis un plat du plateau */}
      {sourceDetail?.source_type === 'recette' && (
        <RecipeDetailWrapper
          recetteId={sourceDetail.source_id}
          onClose={() => setSourceDetail(null)}
        />
      )}
      {sourceDetail?.source_type === 'repas_type' && (
        <MealTemplateDetailWrapper
          repasTypeId={sourceDetail.source_id}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </div>
  )
}
