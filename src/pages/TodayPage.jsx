import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pill } from 'lucide-react'
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
import { ALL_NUTRIENT_KEYS, computeMealTargets, MEALS_ORDER as MEALS } from '../lib/nutrients'

const SUPPLEMENT_MEAL = 'Compléments'

// ── Section compléments alimentaires ──────────────────────────────────────
function SupplementSection({ supplements, onOpenModal, onAdd, onDelete }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 8 }}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <Pill size={14} color="var(--purple, #8b5cf6)" />
          <span className="section-title" style={{ margin: 0, color: 'var(--purple, #8b5cf6)' }}>
            Compléments
          </span>
          {supplements.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              background: 'var(--purple-light, #ede9fe)',
              color: 'var(--purple, #8b5cf6)',
              borderRadius: 10, padding: '1px 7px',
            }}>
              {supplements.length}
            </span>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-hint)', marginLeft: 2 }}>
            {collapsed ? '▸' : '▾'}
          </span>
        </button>

        <button
          onClick={() => onOpenModal({ meal: SUPPLEMENT_MEAL, addEntry: onAdd })}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--purple-light, #ede9fe)',
            color: 'var(--purple, #8b5cf6)',
            border: 'none', borderRadius: 8,
            padding: '5px 10px', fontSize: 12, fontWeight: 700,
            fontFamily: 'var(--font)', cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          Ajouter
        </button>
      </div>

      {!collapsed && (
        <div style={{
          background: 'var(--gray-bg)',
          borderRadius: 'var(--radius-sm, 12px)',
          overflow: 'hidden',
        }}>
          {supplements.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-hint)', textAlign: 'center' }}>
              Aucun complément aujourd'hui
            </div>
          ) : (
            supplements.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  padding: '10px 14px',
                  borderBottom: i < supplements.length - 1 ? '0.5px solid var(--border)' : 'none',
                  gap: 10,
                }}
              >
                <Pill size={13} color="var(--purple, #8b5cf6)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {s.food_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {s.qty_g} g / ml
                  </div>
                </div>
                <button
                  onClick={() => onDelete(s.id)}
                  className="btn-icon"
                  style={{ color: 'var(--text-hint)', flexShrink: 0 }}
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

  console.log('meal_enabled:', settings?.meal_enabled)
console.log('Compléments enabled:', settings?.meal_enabled?.['Compléments'])

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

  const mealTargets = useMemo(() => computeMealTargets(settings), [settings])

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
    <div style={{
  width: '33.333%',
  flexShrink: 0,
  boxSizing: 'border-box',
  padding: '16px 16px 90px',
  height: '100%',                       // ← chaque slot = hauteur du viewport
  overflowY: 'auto',                    // ← scroll indépendant par slot
  WebkitOverflowScrolling: 'touch',     // ← momentum scroll iOS
}}>
      <DateHeader date={date} onNavigate={onNavigate} />
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
              target={mealTargets[m]}
              onAdd={(meal) => onOpenModal({ meal, addEntry: handleAdd })}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
                onOpenDetail={onOpenDetail}
              />
            ))}
        </div>
{true && (
  <SupplementSection
    supplements={entries.filter(e => e.meal === SUPPLEMENT_MEAL)}
    onOpenModal={onOpenModal}
    onAdd={handleAdd}
    onDelete={handleDelete}
  />
)}
      </>
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

  const wrapperRef = useRef(null)

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontal.current = false
    setDragPx(0)
  }, [])

  // onTouchMove doit être non-passif pour pouvoir appeler preventDefault()
  // → on l'attache manuellement via useEffect
  const onTouchMove = useCallback((e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!isHorizontal.current) {
      if (Math.abs(dy) > Math.abs(dx)) return   // geste vertical → scroll normal
      isHorizontal.current = true
    }
    e.preventDefault()   // bloque le scroll seulement si horizontal confirmé
    setDragPx(dx)
  }, [])

  // Attache touchmove avec { passive: false } pour que preventDefault() fonctionne
  React.useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [onTouchMove])

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
        ref={wrapperRef}
        style={{ overflowX: 'hidden', position: 'relative', height: '100%' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slider 3 slots */}
        <div
          style={{
            display: 'flex',
            width: '300%',
            height: '100%',  
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