import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import VitaminPanel from '../components/VitaminPanel'
import MealSection from '../components/MealSection'
import AddFoodModal from '../components/AddFoodModal'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../lib/toast'

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
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function TodayPage() {
  const toast = useToast()
  const [date, setDate] = useState(new Date())
  const { entries, loading, addEntry, deleteEntry, updateEntry } = useJournal(fmt(date))
  const { settings } = useSettings()
  const [modal, setModal] = useState(null) // null | mealName

  const isToday = fmt(date) === fmt(new Date())

  const totals = useMemo(() => {
    const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0, vit_c: 0, vit_d: 0, calcium: 0, fer: 0, magnesium: 0, potassium: 0, vit_b12: 0, vit_a: 0, vit_e: 0 }
    for (const e of entries) {
      t.kcal += e.energie_kcal || 0
      t.prot += e.proteines || 0
      t.gluc += e.glucides || 0
      t.lip  += e.lipides || 0
      t.fib  += e.fibres || 0
      t.vit_c += e.vit_c || 0
      t.vit_d += e.vit_d || 0
      t.calcium += e.calcium || 0
      t.fer += e.fer || 0
      t.magnesium += e.magnesium || 0
      t.potassium += e.potassium || 0
      t.vit_b12 += e.vit_b12 || 0
      t.vit_a += e.vit_a || 0
      t.vit_e += e.vit_e || 0
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
    if (d > new Date()) return
    setDate(d)
  }

  return (
    <>
      <div className="page-content">
        {/* Date navigator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={20} color="var(--text-muted)" /></button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{dateLabel(date)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => navigate(1)} style={{ opacity: isToday ? 0.3 : 1 }} disabled={isToday}>
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
    </>
  )
}
