import React, { useState, useMemo, useRef, useCallback } from 'react'
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

function dateOffset(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
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

// ── Header navigation date ─────────────────────────────────────────────────
function DateHeader({ date, onNavigate }) {
  const isToday = fmt(date) === fmt(new Date())
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <button className="btn-icon" onClick={() => onNavigate(-1)}>
        <ChevronLeft size={20} color="var(--text-muted)" />
      </button>
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => !isToday && onNavigate(0)}  // 0 = retour aujourd'hui
          style={{ fontWeight: 700, fontSize: 16, color: isToday ? 'var(--text)' : 'var(--green)' }}
        >
          {dateLabel(date)}{!isToday && ' ↩'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
          {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <button className="btn-icon" onClick={() => onNavigate(1)}>
        <ChevronRight size={20} color="var(--text-muted)" />
      </button>
    </div>
  )
}

// ── Contenu d'un slot jour ─────────────────────────────────────────────────
function DaySlot({ date, onOpenModal, onOpenDetail, onNavigate }) {
  const toast = useToast()
  const { entries, loading, addEntry, deleteEntry, updateEntry } = useJournal(fmt(date))
  const { settings } = useSettings()

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
  }

  return (
    <div className="page-content" style={{ width: '33.333%', flexShrink: 0, boxSizing: 'border-box' }}>
      <DateHeader date={date} onNavigate={onNavigate} />
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
                onAdd={(meal) => onOpenModal({ meal, addEntry: handleAdd })}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────
export default function TodayPage() {
  const [date, setDate] = useState(new Date())
  // modal = { meal, addEntry } | null
  const [modal, setModal] = useState(null)
  const [detailEntry, setDetailEntry] = useState(null)

  // ── Swipe ───────────────────────────────────────────────────────────────
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const isHorizontal = useRef(false)
  const [dragPx, setDragPx] = useState(0)
  const [animating, setAnimating] = useState(false)
  // settled = true → on vient de finir une nav, on bloque la transition le temps du reset
  const settled = useRef(false)
  const SWIPE_THRESHOLD = 0.15  // 15% de la largeur écran

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontal.current = false
    setDragPx(0)
  }, [])

  const onTouchMove = useCallback((e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!isHorizontal.current) {
      if (Math.abs(dy) > Math.abs(dx)) return   // geste vertical → scroll normal
      isHorizontal.current = true
    }
    e.preventDefault()
    setDragPx(dx)
  }, [])

  const commitNav = useCallback((dir) => {
    // dir = -1 (suivant) ou +1 (précédent)
    // 1. Animer jusqu'au slot voisin
    setAnimating(true)
    setDragPx(dir * window.innerWidth)
    setTimeout(() => {
      // 2. Changer la date ET couper la transition AVANT de reset dragPx
      //    → le slider se retrouve visuellement au même endroit grâce au recalcul
      //      des slots (datePrev/dateNext recalculés), donc aucun saut visible
      settled.current = true
      setDate(d => dateOffset(d, -dir))
      setDragPx(0)
      setAnimating(false)
      // 3. Ré-autoriser la transition au prochain frame
      requestAnimationFrame(() => { settled.current = false })
    }, 280)
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!isHorizontal.current) return
    const threshold = window.innerWidth * SWIPE_THRESHOLD
    if (dragPx < -threshold) {
      commitNav(-1)  // swipe gauche → jour suivant
    } else if (dragPx > threshold) {
      commitNav(1)   // swipe droit → jour précédent
    } else {
      // Retour élastique
      setAnimating(true)
      setDragPx(0)
      setTimeout(() => setAnimating(false), 280)
    }
    touchStartX.current = null
    isHorizontal.current = false
  }, [dragPx, commitNav])

  // navigate appelé depuis DateHeader
  // dir = -1 | 1 | 0 (0 = retour aujourd'hui)
  const navigate = useCallback((dir) => {
    if (dir === 0) {
      setDate(new Date())
    } else {
      commitNav(-dir)  // même sens que le swipe
    }
  }, [commitNav])

  // Position du slider : le slot central est à l'index 1 (0-based), donc offset -100%
  // On ajoute le drag en cours (converti en %)
  const dragPct = (dragPx / window.innerWidth) * 100
  // Le slider fait 300% de large ; chaque slot fait 33.333%
  // translateX du slider : quand dragPct=0, slot central centré → slider à -33.333%
  const sliderTranslate = -33.333 + dragPct / 3

  const datePrev = dateOffset(date, -1)
  const dateNext = dateOffset(date, +1)

  return (
    <>
      {/* Conteneur masquant les slots latéraux */}
      <div
        style={{ overflow: 'hidden', position: 'relative' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Slider 3 slots */}
        <div
          style={{
            display: 'flex',
            width: '300%',
            transform: `translateX(${sliderTranslate}%)`,
            transition: animating ? 'transform .28s cubic-bezier(.25,.46,.45,.94)' : 'none',
            willChange: 'transform',
          }}
        >
          <DaySlot date={datePrev} onOpenModal={setModal} onOpenDetail={setDetailEntry} onNavigate={navigate} />
          <DaySlot date={date}     onOpenModal={setModal} onOpenDetail={setDetailEntry} onNavigate={navigate} />
          <DaySlot date={dateNext} onOpenModal={setModal} onOpenDetail={setDetailEntry} onNavigate={navigate} />
        </div>
      </div>

      {modal && (
        <AddFoodModal
          initialMeal={modal.meal}
          onAdd={modal.addEntry}
          onClose={() => setModal(null)}
        />
      )}

      {detailEntry && (
        <FoodDetailModal
          key={detailEntry.id}
          entry={detailEntry}
          onUpdate={async (id, patch) => {}}
          onClose={() => setDetailEntry(null)}
        />
      )}
    </>
  )
}