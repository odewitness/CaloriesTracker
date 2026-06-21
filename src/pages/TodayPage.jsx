import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import VitaminPanel from '../components/VitaminPanel'
import NutrientDetails from '../components/NutrientDetails'
import MealSection from '../components/MealSection'
import AddFoodModal from '../components/AddFoodModal'
import FoodDetailModal from '../components/FoodDetailModal'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../lib/toast'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'

const MEALS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']

function fmt(date) {
  return date.toISOString().slice(0, 10)
}

function dateLabel(date) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(date); d.setHours(0,0,0,0)
  const diff = (d - today) / 86400000
  if (diff === 0) return "Aujourd'hui"
  if (diff === -1) return 'Hier'
  if (diff === 1) return 'Demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function TodayPage() {
  const toast = useToast()
  const [date, setDate] = useState(new Date())
  const { entries, loading, addEntry, deleteEntry, updateEntry } = useJournal(fmt(date))
  const { settings } = useSettings()
  const [modal, setModal] = useState(null) // null | mealName
  const [detailEntry, setDetailEntry] = useState(null) // null | entrée du journal

  const isToday = fmt(date) === fmt(new Date())

  const totals = useMemo(() => {
    const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 }
    for (const key of ALL_NUTRIENT_KEYS) t[key] = 0
    for (const e of entries) {
      t.kcal += e.energie_kcal || 0
      t.prot += e.proteines || 0
      t.gluc += e.glucides || 0
      t.lip  += e.lipides || 0
      t.fib  += e.fibres || 0
      for (const key of ALL_NUTRIENT_KEYS) t[key] += e[key] || 0
    }
    return t
  }, [entries])

  const handleAdd = async (entry) => {
    const { error } = await addEntry(entry)
    if (!error) toast('✓ Ajouté !')
    else toast('Erreur lors de l\'ajout')
  }

  const handleDelete = async (id) => {
    await deleteEntry(id)
    toast('Supprimé')
  }

  const handleUpdate = async (id, patch) => {
    const { error } = await updateEntry(id, patch)
    if (!error) toast('✓ Modifié !')
    else toast('Erreur')
  }

  const navigate = (dir) => {
    const d = new Date(date)
    d.setDate(d.getDate() + dir)
    setDate(d)
  }

  return (
    <>
      <div className="page-content">
        {/* Date navigator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={20} color="var(--text-muted)" /></button>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => !isToday && setDate(new Date())}
              style={{ fontWeight: 700, fontSize: 16, color: isToday ? 'var(--text)' : 'var(--green)' }}
            >
              {dateLabel(date)}{!isToday && ' ↩'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => navigate(1)}>
            <ChevronRight size={20} color="var(--text-muted)" />
          </button>
        </div>

        {loading ? (
          <div className="loader"><div className="spinner" /> Chargement...</div>
        ) : (
          <>
            <CalorieRing consumed={totals.kcal} goal={settings.goal_kcal} />
            <MacroBar prot={totals.prot} gluc={totals.gluc} lip={totals.lip} fib={totals.fib} goals={settings} />
            <VitaminPanel totals={totals} hasEntries={entries.length > 0} />
            <NutrientDetails totals={totals} hasEntries={entries.length > 0} />

            <div style={{ marginTop: 16 }}>
              <div className="section-title">Repas du jour</div>
              {MEALS.map(m => (
                <MealSection
                  key={m}
                  name={m}
                  entries={entries.filter(e => e.meal === m)}
                  onAdd={(meal) => setModal(meal)}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onOpenDetail={setDetailEntry}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {modal && (
        <AddFoodModal
          initialMeal={modal}
          onAdd={handleAdd}
          onClose={() => setModal(null)}
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
    </>
  )
}