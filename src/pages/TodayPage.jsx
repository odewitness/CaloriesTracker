import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react'
import CalorieRing from '../components/CalorieRing'
import MacroBar from '../components/MacroBar'
import VitaminPanel from '../components/VitaminPanel'
import NutrientDetails from '../components/NutrientDetails'
import MealSection from '../components/MealSection'
import AddFoodModal from '../components/AddFoodModal'
import AddFromMealModal from '../components/AddFromMealModal'
import EditMealTemplatePage from '../components/EditMealTemplatePage'
import FoodDetailModal from '../components/FoodDetailModal'
import EditSupplementModal from '../components/EditSupplementModal'
import SupplementSection, { SUPPLEMENT_MEAL } from '../components/SupplementSection'
import RecipeDetailWrapper from '../components/RecipeDetailWrapper'
import MealTemplateDetailWrapper from '../components/MealTemplateDetailWrapper'
import ShareJournalModal from '../components/ShareJournalModal'
import { useJournal } from '../hooks/useJournal'
import { useSettings } from '../hooks/useSettings'
import { useFeed } from '../hooks/useFeed'
import { saveMealTemplate } from '../hooks/useMealTemplates'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { usePlannedMealsForDate, deletePlannedMeal, deletePlannedMealSeries, markAsEaten } from '../hooks/usePlannedMeals'
import { ALL_NUTRIENT_KEYS, computeMealTargets, MEALS_ORDER as MEALS } from '../lib/nutrients'
import { fmt } from '../lib/dates'

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
function DaySlot({ date, onOpenModal, onOpenDetail, onOpenSource, onNavigate }) {
  const toast = useToast()
  const { user } = useAuth()
  const dateStr = fmt(date)
  const { entries, loading, addEntry, deleteEntry, updateEntry, refetch: refetchJournal } = useJournal(dateStr)
  const { repas: repasPlanifies, refetch: refetchPlanifies } = usePlannedMealsForDate(dateStr)
  const { settings } = useSettings()
  const { shareJournal } = useFeed()
  const [shareTarget, setShareTarget] = useState(null) // { meal: string|null, entries: [...] } | null
  const [templateAddMeal, setTemplateAddMeal] = useState(null)    // nom du repas | null — ajout d'un repas type à ce repas
  const [templateCreateMeal, setTemplateCreateMeal] = useState(null) // nom du repas | null — création d'un repas type depuis ce repas

  const nonMangesPlanifies = useMemo(() => repasPlanifies.filter(r => !r.mange), [repasPlanifies])

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
    return { error }
  }

  // Ajoute les aliments d'un repas type sélectionné (déjà mis à l'échelle par
  // AddFromMealModal) directement au journal de CE jour, pour le repas depuis
  // lequel le menu a été ouvert — pas de re-choix date/repas nécessaire.
  const handleAddFromTemplate = async (meal, items) => {
    let ok = 0
    for (const it of items) {
      const { _idx, ...rest } = it
      const { error } = await addEntry({ meal, ...rest })
      if (!error) ok++
    }
    if (ok > 0) toast(`✓ ${ok} aliment${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''} !`)
    else toast("Erreur lors de l'ajout")
  }

  // Crée un nouveau repas type à partir des aliments déjà enregistrés dans un
  // repas de ce jour — même logique de "nettoyage" des champs que
  // ImportFromDayModal (retire id/date/meal/user_id/created_at).
  const templateSeedItems = useMemo(() => {
    if (!templateCreateMeal) return []
    return entries
      .filter(e => e.meal === templateCreateMeal)
      .map(({ id, date: _d, meal: _m, user_id, created_at, ...rest }) => rest)
  }, [templateCreateMeal, entries])

  const handleSaveTemplateFromMeal = async ({ nom, description, items, nb_portions, categories }) => {
    const { error } = await saveMealTemplate({ userId: user.id, repasTypeId: null, nom, description, items, nbPortions: nb_portions, categories })
    if (!error) toast(`✓ Repas type « ${nom} » créé !`)
    else toast('Erreur')
    setTemplateCreateMeal(null)
  }

  const handleMarkPlannedEaten = async (repas) => {
    const { error } = await markAsEaten(repas, user.id)
    if (!error) { toast(`✓ ${repas.nom} ajouté au journal`); refetchJournal(); refetchPlanifies() }
    else toast('Erreur')
  }

  const handleDeletePlanned = async (id) => {
    const { error } = await deletePlannedMeal(id, user.id)
    if (!error) { toast('Supprimé'); refetchPlanifies() }
    else toast('Erreur')
  }

  const handleDeleteSeries = async (recurrenceGroupId) => {
    const { error } = await deletePlannedMealSeries(recurrenceGroupId, user.id)
    if (!error) { toast('Série supprimée'); refetchPlanifies() }
    else toast('Erreur')
  }

  const confirmShareJournal = async (message, includeDetail) => {
    const { error } = await shareJournal({ date: dateStr, meal: shareTarget.meal, entries: shareTarget.entries, includeDetail, message })
    if (!error) toast('✓ Partagé avec tes amies !')
    else toast('Erreur lors du partage')
    setShareTarget(null)
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
        <VitaminPanel totals={totals} hasEntries={entries.length > 0} entries={entries} onUpdate={handleUpdate} />
        <NutrientDetails totals={totals} hasEntries={entries.length > 0} entries={entries} onUpdate={handleUpdate} />
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Repas du jour</div>
            {entries.length > 0 && (
              <button
                onClick={() => setShareTarget({ meal: null, entries })}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-hint)', padding: '4px 2px' }}
              >
                <Share2 size={13} /> Partager ma journée
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
              onAdd={(meal) => onOpenModal({ meal, addEntry: handleAdd })}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onOpenDetail={(entry) => onOpenDetail({ entry, onUpdate: handleUpdate })}
              onMarkPlannedEaten={handleMarkPlannedEaten}
              onDeletePlanned={handleDeletePlanned}
              onDeleteSeries={handleDeleteSeries}
              onOpenPlannedSource={onOpenSource}
              onShare={(meal) => setShareTarget({ meal, entries: entries.filter(e => e.meal === meal) })}
              onAddFromTemplate={setTemplateAddMeal}
              onCreateTemplate={setTemplateCreateMeal}
            />
          ))}
        </div>
        <SupplementSection
          supplements={entries.filter(e => e.meal === SUPPLEMENT_MEAL)}
          plannedSupplements={nonMangesPlanifies.filter(r => r.meal === SUPPLEMENT_MEAL)}
          onOpenModal={onOpenModal}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onMarkPlannedEaten={handleMarkPlannedEaten}
          onDeletePlanned={handleDeletePlanned}
          onOpenDetail={(entry) => onOpenDetail({ entry, onUpdate: handleUpdate })}
          onOpenPlannedSource={onOpenSource}
        />
      </>

      {shareTarget && (
        <ShareJournalModal
          title={shareTarget.meal ? `Partager ce repas` : 'Partager cette journée'}
          subtitle={shareTarget.meal ? shareTarget.meal : dateLabel(date)}
          onConfirm={confirmShareJournal}
          onClose={() => setShareTarget(null)}
        />
      )}

      {templateAddMeal && (
        <AddFromMealModal
          onAdd={(repas, items) => handleAddFromTemplate(templateAddMeal, items)}
          onClose={() => setTemplateAddMeal(null)}
        />
      )}

      {templateCreateMeal && (
        <EditMealTemplatePage
          repas={{ items: templateSeedItems, nb_portions: 1 }}
          onSave={handleSaveTemplateFromMeal}
          onClose={() => setTemplateCreateMeal(null)}
        />
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
  const [sourceDetail, setSourceDetail] = useState(null) // repas_planifies en cours de "voir sa page dédiée"

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
          <DaySlot date={datePrev} onOpenModal={setModal} onOpenDetail={setDetailEntry} onOpenSource={setSourceDetail} onNavigate={navigate} />
          <DaySlot date={date}     onOpenModal={setModal} onOpenDetail={setDetailEntry} onOpenSource={setSourceDetail} onNavigate={navigate} />
          <DaySlot date={dateNext} onOpenModal={setModal} onOpenDetail={setDetailEntry} onOpenSource={setSourceDetail} onNavigate={navigate} />
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
        detailEntry.entry.meal === SUPPLEMENT_MEAL ? (
          <EditSupplementModal
            key={detailEntry.entry.id}
            entry={detailEntry.entry}
            onUpdate={detailEntry.onUpdate}
            onClose={() => setDetailEntry(null)}
          />
        ) : (
          <FoodDetailModal
            key={detailEntry.entry.id}
            entry={detailEntry.entry}
            onUpdate={detailEntry.onUpdate}
            onClose={() => setDetailEntry(null)}
          />
        )
      )}

      {/* "Page dédiée" d'un repas/complément planifié : recette / repas type / aliment */}
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
    </>
  )
}