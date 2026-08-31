import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CornerUpLeft, Plus, Check, Trash2, Wand2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { MEALS_ORDER } from '../lib/nutrients'
import { deletePlannedMeal, deletePlannedMeals, markAsEaten } from '../hooks/usePlannedMeals'
import { fmt } from '../lib/dates'
import { readAppliedPlans } from '../lib/mealPlannerApply'
import PlanMealModal from './PlanMealModal'
import MealPlannerModal from './MealPlannerModal'

// ─────────────────────────────────────────────────────────────────────────────
// WeekMenuBoard (roadmap §M5) — plateau de menus de la semaine : 7 jours
// empilés (lisible sur mobile, contrairement à une grille 7×4), chaque jour
// avec ses lignes de repas activés. On y ajoute un repas planifié sur une case
// précise ("+"), on le retire, ou on le marque mangé (→ journal). C'est une
// autre entrée sur les mêmes données que le calendrier (repas_planifies), pas
// un stockage à part.
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
  const [busyId, setBusyId] = useState(null)
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [appliedGroupIds, setAppliedGroupIds] = useState(() => new Set(readAppliedPlans().map(p => p.groupId)))
  const [removingPlan, setRemovingPlan] = useState(false)

  // Re-lit la liste des plans générés appliqués (stashée en localStorage par
  // MealPlannerModal) à la fermeture de la modale.
  useEffect(() => {
    if (!plannerOpen) setAppliedGroupIds(new Set(readAppliedPlans().map(p => p.groupId)))
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

  // Lignes de la semaine affichée qui appartiennent à un plan généré par le
  // planificateur (recurrence_group_id présent dans le stash).
  const weekPlanRows = useMemo(() => {
    if (!appliedGroupIds.size) return []
    return days
      .flatMap(d => plannedByDate?.[d] || [])
      .filter(r => r.recurrence_group_id && appliedGroupIds.has(r.recurrence_group_id))
  }, [days, plannedByDate, appliedGroupIds])

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

  const handleEat = async (repas) => {
    setBusyId(repas.id)
    const { error } = await markAsEaten(repas, user.id)
    setBusyId(null)
    setMenuFor(null)
    if (error) { toast('Erreur'); return }
    toast('✓ Marqué mangé')
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

      {/* Générateur automatique de plan (chantier planificateur de repas) */}
      <button
        onClick={() => setPlannerOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%',
          padding: '10px 12px', marginBottom: weekPlanRows.length ? 6 : 12, borderRadius: 'var(--radius-sm)',
          background: 'var(--green-light)', color: 'var(--green-dark)', border: 'none',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
        }}
      >
        <Wand2 size={15} /> Générer un plan de repas
      </button>

      {weekPlanRows.length > 0 && (
        <button
          onClick={handleRemovePlan}
          disabled={removingPlan}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
            padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
            background: 'none', color: 'var(--coral)', border: '1px solid var(--coral-light)',
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
          }}
        >
          <Trash2 size={13} />
          {removingPlan ? 'Retrait…' : `Retirer le plan généré de cette semaine (${weekPlanRows.length} repas)`}
        </button>
      )}

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
        const dayKcal = (plannedByDate?.[dateStr] || []).reduce(
          (s, r) => s + (r.items || []).reduce((ss, i) => ss + (i.energie_kcal || 0), 0), 0,
        )

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
                <span style={{ fontSize: 11.5, color: 'var(--text-hint)', fontWeight: 600 }}>{Math.round(dayKcal)} kcal</span>
              )}
            </div>

            {enabledMeals.map(meal => {
              const list = byMeal[meal] || []
              return (
                <div key={meal} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, width: 78, flexShrink: 0, paddingTop: 4 }}>
                    {meal}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                    {list.map(r => {
                      const kcal = (r.items || []).reduce((s, i) => s + (i.energie_kcal || 0), 0)
                      return (
                        <span key={r.id} style={{ position: 'relative' }}>
                          <button
                            onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                            disabled={busyId === r.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, maxWidth: 190,
                              background: r.mange ? 'var(--green-light)' : 'var(--gray-bg)',
                              color: r.mange ? 'var(--green-dark)' : 'var(--text)',
                              border: 'none', borderRadius: 7, padding: '4px 8px',
                              fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)',
                            }}
                          >
                            {r.mange && <Check size={11} style={{ flexShrink: 0 }} />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nom}</span>
                            {kcal > 0 && <span style={{ color: 'var(--text-hint)', fontWeight: 500, flexShrink: 0 }}>· {Math.round(kcal)}</span>}
                          </button>

                          {menuFor === r.id && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setMenuFor(null)} />
                              <div className="card" style={{ position: 'absolute', top: 28, left: 0, zIndex: 20, padding: 4, minWidth: 150 }}>
                                {!r.mange && (
                                  <button
                                    onClick={() => handleEat(r)}
                                    style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                                  >
                                    <Check size={14} /> Marquer mangé
                                  </button>
                                )}
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
        />
      )}
    </div>
  )
}
