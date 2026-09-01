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
// empilés (lisible sur mobile, contrairement à une grille 7×4), chaque jour
// avec ses lignes de repas activés. On y ajoute un repas planifié sur une case
// précise ("+"), on le retire (menu ⋮), ou on ouvre la fiche de la recette /
// du repas type en cliquant sur le plat. C'est une autre entrée sur les mêmes
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

      {/* Résumé de la semaine affichée */}
      {enabledMeals.length > 0 && (
        <div className="card" style={{ padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Repas planifiés</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>
              {weekStats.planned} <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}>/ {weekStats.slots}</span>
            </div>
          </div>
          {weekStats.avgKcal > 0 && dayKcalTarget > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Moy. / jour planifié</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, color: LEVEL_COLOR[deviationLevel(weekStats.avgKcal, dayKcalTarget)] }}>
                {weekStats.avgKcal} <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}>/ {dayKcalTarget} kcal</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barre d'actions. Générer un plan : uniquement quand la semaine n'en a
          pas encore un (« Modifier mon plan » est en bas, près de « Retirer »).
          « Ma fournée » : toujours dispo. */}
      {!hasWeekPlan && (
        <button
          onClick={() => setPlannerOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
            padding: '11px 12px', marginBottom: 6, borderRadius: 'var(--radius-sm)',
            background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
          }}
        >
          <Wand2 size={15} /> Générer un plan de repas
        </button>
      )}

      <button
        onClick={() => setBatchOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
          padding: '8px 10px', marginBottom: 14, borderRadius: 'var(--radius-sm)',
          background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)',
          fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
        }}
      >
        <ChefHat size={14} /> Ma fournée
      </button>

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

            {enabledMeals.map(meal => {
              const list = byMeal[meal] || []
              return (
                <div key={meal} style={{ padding: '5px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                    {meal}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'flex-start' }}>
                    {list.map(r => {
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

                    <button
                      onClick={() => setPlanSlot({ date: dateStr, meal })}
                      aria-label={`Planifier ${meal} le ${dateStr}`}
                      style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
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
