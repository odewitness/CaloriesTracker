import React, { useMemo, useState } from 'react'
import { Share2 } from 'lucide-react'
import CalorieRing from './CalorieRing'
import MacroBar from './MacroBar'
import NutrientPanel from './NutrientPanel'
import MealSection from './MealSection'
import AddFoodModal from './AddFoodModal'
import FoodDetailModal from './FoodDetailModal'
import EditSupplementModal from './EditSupplementModal'
import SupplementSection, { SUPPLEMENT_MEAL } from './SupplementSection'
import WaterSection from './WaterSection'
import AddWaterSheet from './AddWaterSheet'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import MealTemplateDetailWrapper from './MealTemplateDetailWrapper'
import ShareJournalModal from './ShareJournalModal'
import ExcludeDayBanner from './ExcludeDayBanner'
import { useJournal } from '../hooks/useJournal'
import { useExcludedDay } from '../hooks/useExcludedDays'
import { useSettings } from '../hooks/useSettings'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFeed } from '../hooks/useFeed'
import { isWaterEntry, buildWaterEntry, pickDefaultBeverage } from '../lib/water'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { usePlannedMealsForDate, deletePlannedMeal, deletePlannedMealSeries, markAsEaten } from '../hooks/usePlannedMeals'
import { computeTotals, computeMealTargets, MEALS_ORDER as MEALS } from '../lib/nutrients'
import Loader from './Loader'
import { fmt } from '../lib/dates'

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
// Réutilise la même logique que TodayPage : CalorieRing, MacroBar (affichage
// séparé ici, contrairement à TodayOverviewCard sur la page du jour qui les
// fusionne avec les flèches de navigation — pas de swipe ici), NutrientPanel,
// puis "Repas du jour" avec un
// MealSection par repas (toggle, ajout, suppression) + SupplementSection —
// donc les repas réellement mangés ce jour-là (planifiés ou non) s'affichent
// tous. Les repas/compléments encore planifiés mais pas mangés s'affichent
// en cartes distinctes DANS chaque MealSection/SupplementSection concernée
// (plannedItems/plannedSupplements), avec l'action "Marquer mangé" directement
// là. Le bouton "Planifier..." vit désormais en haut de CalendarPage, pas ici.
// Props :
//   date        — Date sélectionnée
//   onPlannedChange() — notifie le parent (calendrier) qu'un repas planifié a
//                        changé, pour rafraîchir les points violets/verts
// ─────────────────────────────────────────────────────────────────────────────
export default function DayRecapPanel({ date, onPlannedChange, onExcludedChange }) {
  const dateStr = fmt(date)
  const { user } = useAuth()
  const toast = useToast()
  const { entries, loading, addEntry, deleteEntry, updateEntry, refetch: refetchJournal } = useJournal(dateStr)
  const { excluded, toggle: toggleExcluded } = useExcludedDay(dateStr)
  const { settings, update: updateSettings } = useSettings()
  const { foods: ciqualFoods } = useCiqualCatalog()
  const { repas: repasPlanifies, refetch: refetchPlanifies } = usePlannedMealsForDate(dateStr)
  const { shareJournal } = useFeed()

  const [modal, setModal] = useState(null) // { meal, addEntry } — AddFoodModal, même pattern que TodayPage
  const [detailEntry, setDetailEntry] = useState(null)
  const [sourceDetail, setSourceDetail] = useState(null) // repas_planifies en cours de "voir sa page dédiée"
  const [shareTarget, setShareTarget] = useState(null) // { meal: string|null, entries: [...] } | null
  const [waterSheetOpen, setWaterSheetOpen] = useState(false)

  const waterEntries = useMemo(() => entries.filter(isWaterEntry), [entries])
  const waterCfg = settings.water
  const defaultBeverage = useMemo(
    () => pickDefaultBeverage(ciqualFoods, waterCfg?.default_food_ref_id),
    [ciqualFoods, waterCfg?.default_food_ref_id]
  )
  const handleWaterQuickAdd = async (ml) => {
    if (!defaultBeverage) { toast('Boissons en cours de chargement…'); return }
    const { error } = await addEntry(buildWaterEntry(defaultBeverage, ml))
    if (error) toast("Erreur lors de l'ajout")
  }
  const handleWaterUndo = async () => {
    const last = waterEntries[waterEntries.length - 1]
    if (last) await deleteEntry(last.id)
  }
  const handleUpdateWater = (patch) => updateSettings({ water: { ...waterCfg, ...patch } })

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
    if (!error) { toast(`✓ ${repas.nom} ajouté au journal`); refetchJournal(); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }

  const handleDeletePlanifie = async (id) => {
    const { error } = await deletePlannedMeal(id, user.id)
    if (!error) { toast('Supprimé'); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }

  const handleDeleteSeries = async (recurrenceGroupId) => {
    const { error } = await deletePlannedMealSeries(recurrenceGroupId, user.id)
    if (!error) { toast('Série supprimée'); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }

  const confirmShareJournal = async (message, includeDetail) => {
    const { error } = await shareJournal({ date: dateStr, meal: shareTarget.meal, entries: shareTarget.entries, includeDetail, message })
    if (!error) toast('✓ Partagé avec tes amies !')
    else toast('Erreur lors du partage')
    setShareTarget(null)
  }

  if (loading) {
    return <Loader />
  }

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, textTransform: 'capitalize' }}>
        {dateLabel(date)}
      </div>

      <ExcludeDayBanner excluded={excluded} onToggle={async () => { await toggleExcluded(); onExcludedChange?.() }} />

      <CalorieRing consumed={totals.kcal} goal={settings.goal_kcal} />
      <MacroBar prot={totals.prot} gluc={totals.gluc} lip={totals.lip} fib={totals.fib} goals={settings} />
      <NutrientPanel totals={totals} hasEntries={hasEntries} entries={entries} onUpdate={handleUpdate} />

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Repas</div>
          {entries.length > 0 && (
            <button
              onClick={() => setShareTarget({ meal: null, entries })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-hint)', padding: '4px 2px' }}
            >
              <Share2 size={13} /> Partager cette journée
            </button>
          )}
        </div>

        {MEALS.map(m => (
          <MealSection
            key={m}
            name={m}
            entries={entries.filter(e => e.meal === m)}
            target={mealTargets[m]}
            plannedItems={nonMangesPlanifies.filter(r => r.meal === m)}
            onAdd={(meal) => setModal({ meal, addEntry: handleAdd })}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onOpenDetail={(entry) => setDetailEntry(entry)}
            onMarkPlannedEaten={handleMarkEaten}
            onDeletePlanned={handleDeletePlanifie}
            onDeleteSeries={handleDeleteSeries}
            onOpenPlannedSource={(repas) => setSourceDetail(repas)}
            onShare={(meal) => setShareTarget({ meal, entries: entries.filter(e => e.meal === meal) })}
          />
        ))}
      </div>

      <SupplementSection
        supplements={entries.filter(e => e.meal === SUPPLEMENT_MEAL)}
        plannedSupplements={nonMangesPlanifies.filter(r => r.meal === SUPPLEMENT_MEAL)}
        onOpenModal={setModal}
        onAdd={handleAdd}
        onDelete={handleDelete}
        onMarkPlannedEaten={handleMarkEaten}
        onDeletePlanned={handleDeletePlanifie}
        onOpenDetail={(entry) => setDetailEntry(entry)}
        onOpenPlannedSource={(repas) => setSourceDetail(repas)}
      />

      {settings.water?.card_visible !== false && (
        <WaterSection
          entries={waterEntries}
          water={waterCfg}
          beverageName={defaultBeverage?.alim_nom}
          onQuickAdd={handleWaterQuickAdd}
          onUndo={handleWaterUndo}
          onOpenSheet={() => setWaterSheetOpen(true)}
        />
      )}

      {modal && (
        <AddFoodModal
          initialMeal={modal.meal}
          onAdd={modal.addEntry}
          onClose={() => setModal(null)}
        />
      )}

      {waterSheetOpen && (
        <AddWaterSheet
          entries={waterEntries}
          water={waterCfg}
          onUpdateWater={handleUpdateWater}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onClose={() => setWaterSheetOpen(false)}
        />
      )}

      {detailEntry && (
        detailEntry.meal === SUPPLEMENT_MEAL ? (
          <EditSupplementModal
            key={detailEntry.id}
            entry={detailEntry}
            onUpdate={handleUpdate}
            onClose={() => setDetailEntry(null)}
          />
        ) : (
          <FoodDetailModal
            key={detailEntry.id}
            entry={detailEntry}
            onUpdate={handleUpdate}
            onClose={() => setDetailEntry(null)}
          />
        )
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
        sourceDetail.meal === SUPPLEMENT_MEAL ? (
          <EditSupplementModal
            key={sourceDetail.id}
            entry={{ ...sourceDetail.items?.[0], meal: sourceDetail.meal }}
            onClose={() => setSourceDetail(null)}
          />
        ) : (
          <FoodDetailModal
            key={sourceDetail.id}
            entry={sourceDetail.items?.[0]}
            onClose={() => setSourceDetail(null)}
          />
        )
      )}

      {shareTarget && (
        <ShareJournalModal
          title={shareTarget.meal ? 'Partager ce repas' : 'Partager cette journée'}
          subtitle={shareTarget.meal ? shareTarget.meal : dateLabel(date)}
          onConfirm={confirmShareJournal}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}