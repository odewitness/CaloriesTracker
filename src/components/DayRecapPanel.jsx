import React, { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import CalorieRing from './CalorieRing'
import MacroBar from './MacroBar'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
import MealSection from './MealSection'
import AddFoodModal from './AddFoodModal'
import FoodDetailModal from './FoodDetailModal'
import SupplementSection, { SUPPLEMENT_MEAL } from './SupplementSection'
import PlannedMealCard from './PlannedMealCard'
import PlanMealModal from './PlanMealModal'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import MealTemplateDetailWrapper from './MealTemplateDetailWrapper'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { usePlannedMealsForDate, deletePlannedMeal, markAsEaten } from '../hooks/usePlannedMeals'
import { computeTotals, computeMealTargets, MEALS_ORDER as MEALS } from '../lib/nutrients'

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const diff = (d - today) / 86400000
  if (diff === 0) return "Aujourd'hui"
  if (diff === -1) return 'Hier'
  if (diff === 1) return 'Demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ─────────────────────────────────────────────────────────────────────────────
// DayRecapPanel — récap complet d'UNE date choisie dans le calendrier.
// Réutilise EXACTEMENT la même mise en page que TodayPage : CalorieRing,
// MacroBar, VitaminPanel, NutrientDetails, puis "Repas du jour" avec un
// MealSection par repas (toggle, ajout, suppression) + SupplementSection —
// donc les repas réellement mangés ce jour-là (planifiés ou non) s'affichent
// tous. Les repas encore planifiés mais pas mangés restent visibles à part,
// juste au-dessus, avec l'action "Marquer mangé".
// Props :
//   date        — Date sélectionnée
//   onPlannedChange() — notifie le parent (calendrier) qu'un repas planifié a
//                        changé, pour rafraîchir les points violets/verts
// ─────────────────────────────────────────────────────────────────────────────
export default function DayRecapPanel({ date, onPlannedChange }) {
  const dateStr = fmt(date)
  const { user } = useAuth()
  const toast = useToast()
  const { entries, loading, addEntry, deleteEntry, updateEntry } = useJournal(dateStr)
  const { settings } = useSettings()
  const { repas: repasPlanifies, loading: loadingPlanifies, refetch: refetchPlanifies } = usePlannedMealsForDate(dateStr)

  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [modal, setModal] = useState(null) // { meal, addEntry } — AddFoodModal, même pattern que TodayPage
  const [detailEntry, setDetailEntry] = useState(null)
  const [sourceDetail, setSourceDetail] = useState(null) // repas_planifies en cours de "voir sa page dédiée"

  const totals = useMemo(() => computeTotals(entries), [entries])
  const hasEntries = entries.length > 0
  const mealTargets = useMemo(() => computeMealTargets(settings), [settings])
  const nonMangesPlanifies = useMemo(() => repasPlanifies.filter(r => !r.mange), [repasPlanifies])

  const handleAdd = async (entry) => {
    const { error } = await addEntry(entry)
    if (!error) toast('✓ Ajouté !')
    else toast("Erreur lors de l'ajout")
  }

  const handleDelete = async (id) => {
    await deleteEntry(id)
    toast('Supprimé')
  }

  const handleUpdate = async (id, patch) => {
    const { error } = await updateEntry(id, patch)
    if (!error) toast('✓ Modifié !')
    else toast('Erreur')
    return { error }
  }

  const handleMarkEaten = async (repas) => {
    const { error } = await markAsEaten(repas, user.id)
    if (!error) { toast(`✓ ${repas.nom} ajouté au journal`); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }

  const handleDeletePlanifie = async (id) => {
    const { error } = await deletePlannedMeal(id, user.id)
    if (!error) { toast('Supprimé'); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }
  if (loading) {
    return <div className="loader"><div className="spinner" /> Chargement...</div>
  }

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, textTransform: 'capitalize' }}>
        {dateLabel(date)}
      </div>

      <CalorieRing consumed={totals.kcal} goal={settings.goal_kcal} />
      <MacroBar prot={totals.prot} gluc={totals.gluc} lip={totals.lip} fib={totals.fib} goals={settings} />
      <VitaminPanel totals={totals} hasEntries={hasEntries} entries={entries} onUpdate={handleUpdate} />
      <NutrientDetails totals={totals} hasEntries={hasEntries} entries={entries} onUpdate={handleUpdate} />

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Repas</div>
          <button
            onClick={() => setPlanModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--purple-light, #ede9fe)', color: 'var(--purple, #8b5cf6)',
              border: 'none', borderRadius: 8, padding: '5px 10px',
              fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            <Plus size={13} /> Planifier un repas
          </button>
        </div>

        {/* Repas encore planifiés, pas encore mangés — au-dessus, distincts */}
        {!loadingPlanifies && nonMangesPlanifies.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {nonMangesPlanifies.map(r => (
              <PlannedMealCard
                key={r.id}
                repas={r}
                onMarkEaten={handleMarkEaten}
                onDelete={handleDeletePlanifie}
                onOpenSource={r.source_type ? (repas) => setSourceDetail(repas) : undefined}
              />
            ))}
          </div>
        )}

        {/* Repas réellement mangés — même component/mise en page que TodayPage */}
        {MEALS.map(m => (
          <MealSection
            key={m}
            name={m}
            entries={entries.filter(e => e.meal === m)}
            target={mealTargets[m]}
            onAdd={(meal) => setModal({ meal, addEntry: handleAdd })}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onOpenDetail={(entry) => setDetailEntry(entry)}
          />
        ))}
      </div>

      <SupplementSection
        supplements={entries.filter(e => e.meal === SUPPLEMENT_MEAL)}
        onOpenModal={setModal}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />

      {modal && (
        <AddFoodModal
          initialMeal={modal.meal}
          onAdd={modal.addEntry}
          onClose={() => setModal(null)}
        />
      )}

      {planModalOpen && (
        <PlanMealModal
          defaultDate={date}
          onClose={() => setPlanModalOpen(false)}
          onPlanned={() => { refetchPlanifies(); onPlannedChange?.() }}
        />
      )}

      {detailEntry && (
        <FoodDetailModal
          key={detailEntry.id}
          entry={detailEntry}
          onUpdate={handleUpdate}
          onClose={() => setDetailEntry(null)}
        />
      )}

      {/* "Page dédiée" d'un repas planifié : recette / repas type / aliment */}
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
      {sourceDetail?.source_type === 'libre' && (
        <FoodDetailModal
          key={sourceDetail.id}
          entry={sourceDetail.items?.[0]}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </div>
  )
}