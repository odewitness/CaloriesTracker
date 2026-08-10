import React, { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import CalorieRing from './CalorieRing'
import MacroBar from './MacroBar'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
import PlannedMealCard from './PlannedMealCard'
import PlanMealModal from './PlanMealModal'
import FoodDetailModal from './FoodDetailModal'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { useRepasPlanifiesForDate, deleteRepasPlanifie, markAsMange } from '../hooks/useRepasPlanifies'
import { computeTotals } from '../lib/nutrients'

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
// Réutilise TEL QUEL CalorieRing / MacroBar / VitaminPanel / NutrientDetails
// (déjà génériques via totals/hasEntries/entries — aucune modif nécessaire) +
// useJournal(date) (déjà générique) + la liste des repas planifiés du jour.
// Props :
//   date        — Date sélectionnée
//   onPlannedChange() — notifie le parent (calendrier) qu'un repas planifié a
//                        changé, pour rafraîchir les points violets/verts
// ─────────────────────────────────────────────────────────────────────────────
export default function DayRecapPanel({ date, onPlannedChange }) {
  const dateStr = fmt(date)
  const { user } = useAuth()
  const toast = useToast()
  const { entries, loading, updateEntry } = useJournal(dateStr)
  const { settings } = useSettings()
  const { repas: repasPlanifies, loading: loadingPlanifies, refetch: refetchPlanifies } = useRepasPlanifiesForDate(dateStr)

  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState(null)

  const totals = useMemo(() => computeTotals(entries), [entries])
  const hasEntries = entries.length > 0

  const handleUpdate = async (id, patch) => {
    const { error } = await updateEntry(id, patch)
    if (!error) toast('✓ Modifié !')
    else toast('Erreur')
    return { error }
  }

  const handleMarkEaten = async (repas) => {
    const { error } = await markAsMange(repas, user.id)
    if (!error) { toast(`✓ ${repas.nom} ajouté au journal`); refetchPlanifies(); onPlannedChange?.() }
    else toast('Erreur')
  }

  const handleDeletePlanifie = async (id) => {
    const { error } = await deleteRepasPlanifie(id, user.id)
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
          <div className="section-title" style={{ marginBottom: 0 }}>Repas planifiés</div>
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

        {loadingPlanifies && <div className="loader" style={{ padding: 16 }}><div className="spinner" /></div>}

        {!loadingPlanifies && repasPlanifies.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-hint)', textAlign: 'center', padding: '14px 0' }}>
            Aucun repas planifié pour ce jour
          </div>
        )}

        {repasPlanifies.map(r => (
          <PlannedMealCard
            key={r.id}
            repas={r}
            onMarkEaten={handleMarkEaten}
            onDelete={handleDeletePlanifie}
          />
        ))}
      </div>

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
    </div>
  )
}
