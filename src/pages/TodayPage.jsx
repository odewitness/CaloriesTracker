import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import TodayOverviewCard from '../components/TodayOverviewCard'
import NutrientPanel from '../components/NutrientPanel'
import MealSection from '../components/MealSection'
import AddFoodModal from '../components/AddFoodModal'
import AddFromMealModal from '../components/AddFromMealModal'
import EditMealTemplatePage from '../components/EditMealTemplatePage'
import FoodDetailModal from '../components/FoodDetailModal'
import EditSupplementModal from '../components/EditSupplementModal'
import SupplementSection, { SUPPLEMENT_MEAL } from '../components/SupplementSection'
import WaterSection from '../components/WaterSection'
import AddWaterSheet from '../components/AddWaterSheet'
import RecipeDetailWrapper from '../components/RecipeDetailWrapper'
import MealTemplateDetailWrapper from '../components/MealTemplateDetailWrapper'
import ShareJournalModal from '../components/ShareJournalModal'
import TodayGapsSection from '../components/TodayGapsSection'
import DayShortcutsBar from '../components/DayShortcutsBar'
import CyclePhaseBadge from '../components/CyclePhaseBadge'
import PlanMealModal from '../components/PlanMealModal'
import { useJournal } from '../hooks/useJournal'
import { useExcludedDay } from '../hooks/useExcludedDays'
import { useCycle } from '../hooks/useCycle'
import { useSettings } from '../hooks/useSettings'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { useFavorites } from '../hooks/useFavorites'
import { isWaterEntry, buildWaterEntry, pickDefaultBeverage } from '../lib/water'
import { useFeed } from '../hooks/useFeed'
import { saveMealTemplate } from '../hooks/useMealTemplates'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { usePlannedMealsForDate, deletePlannedMeal, deletePlannedMealSeries, markAsEaten } from '../hooks/usePlannedMeals'
import { computeMealTargets, computeTotals, MEALS_ORDER as MEALS } from '../lib/nutrients'
import { getNutrientGaps, getGapAmount } from '../lib/ciqualExplorer'
import { cycleAdjustedSettings, phaseForDate, microFocusForPhase } from '../lib/cycle'
import { fmt, dateLabel } from '../lib/dates'
import { useSetTodayHeaderInfo, useTodayShortcuts } from '../lib/TodayHeaderContext'

function dateOffset(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// ── Contenu d'un slot jour ─────────────────────────────────────────────────
function DaySlot({ date, onOpenModal, onOpenDetail, onOpenSource, onNavigate }) {
  const toast = useToast()
  const { user } = useAuth()
  const dateStr = fmt(date)
  const isToday = dateStr === fmt(new Date())
  const { entries, loading, addEntry, deleteEntry, updateEntry, refetch: refetchJournal } = useJournal(dateStr)
  const { excluded, toggle: toggleExcluded } = useExcludedDay(dateStr)
  const { days: cycleDays } = useCycle()
  const { favorites } = useFavorites()
  const { repas: repasPlanifies, refetch: refetchPlanifies } = usePlannedMealsForDate(dateStr)
  const { settings, update: updateSettings } = useSettings()
  const { foods: ciqualFoods } = useCiqualCatalog()
  const { shareJournal } = useFeed()
  const [shareTarget, setShareTarget] = useState(null) // { meal: string|null, entries: [...] } | null
  const [templateAddMeal, setTemplateAddMeal] = useState(null)    // nom du repas | null — ajout d'un repas type à ce repas
  const [templateCreateMeal, setTemplateCreateMeal] = useState(null) // nom du repas | null — création d'un repas type depuis ce repas
  const [waterSheetOpen, setWaterSheetOpen] = useState(false)
  const [planMealOpen, setPlanMealOpen] = useState(false)
  const { open: shortcutsOpen } = useTodayShortcuts()

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

  const nonMangesPlanifies = useMemo(() => repasPlanifies.filter(r => !r.mange), [repasPlanifies])

  const totals = useMemo(() => computeTotals(entries), [entries])

  // Objectifs du jour éventuellement ajustés selon la phase du cycle
  // (Palier 3, opt-in) — n'ajoute que des kcal en phase lutéale, sinon
  // renvoie `settings` inchangé. Utilisé pour tous les calculs d'objectif de
  // CE jour ; `settings` brut reste la source pour water / réglages.
  const daySettings = useMemo(
    () => cycleAdjustedSettings(settings, cycleDays, dateStr),
    [settings, cycleDays, dateStr],
  )
  const cycleKcalDelta = daySettings._cycleKcalDelta || 0

  const cyclePhase = useMemo(() => (
    settings.cycle?.enabled && cycleDays.length ? phaseForDate(dateStr, cycleDays, settings.cycle) : null
  ), [settings.cycle, cycleDays, dateStr])
  const microFocusKeys = useMemo(
    () => microFocusForPhase(cyclePhase, settings.cycle).map(f => f.key),
    [cyclePhase, settings.cycle],
  )

  const mealTargets = useMemo(() => computeMealTargets(daySettings), [daySettings])

  // Manques nutritionnels du jour (voir ciqualExplorer.js, même logique que
  // la bande "À combler aujourd'hui" de l'Explorer) — calculés pour tout
  // slot (pas seulement "aujourd'hui") car ils servent aussi au grammage
  // "comble le manque" du FoodPicker quand on ajoute un aliment à CE jour,
  // qu'il s'agisse d'hier, demain ou aujourd'hui.
  // Chaque manque porte son grammage absolu (voir getGapAmount) : la section
  // "À combler aujourd'hui" s'en sert pour afficher le % de manque couvert
  // par une suggestion, y compris quand la pastille choisie n'est pas dans
  // les 10 premières (feuille "…").
  const allGaps = useMemo(() => (
    getNutrientGaps(totals, daySettings, Infinity)
      .map(g => ({ ...g, missing: getGapAmount(totals, daySettings, g.field) }))
  ), [totals, daySettings])
  const gaps    = useMemo(() => allGaps.slice(0, 3), [allGaps])

  // Les 10 manques les plus urgents — sert au moteur de suggestion de
  // TodayGapsSection ET au Food Picker (voir FoodRow), qui cherchent tous
  // deux pour chaque aliment CELUI de ces 10 manques qu'il comble le plus
  // efficacement (pas forcément le n°1 : un aliment peut être médiocre sur le
  // manque le plus urgent mais excellent sur le 4e).
  const top10Gaps = useMemo(() => (
    allGaps.slice(0, 10).map(g => ({ field: g.field, missing: g.missing }))
  ), [allGaps])

  // Calories restantes du jour — sert à TodayGapsSection pour privilégier des
  // suggestions qui tiennent dans le budget plutôt que n'importe quel aliment
  // qui comble le manque au prix d'un dépassement.
  const remainingKcal = daySettings.goal_kcal != null ? daySettings.goal_kcal - totals.kcal : null

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
  overscrollBehavior: 'contain',        // ← empêche le rebond/chaînage de scroll en bas de page
  WebkitOverflowScrolling: 'touch',     // ← momentum scroll iOS
}}>
      <>
        {shortcutsOpen && (
          <DayShortcutsBar
            excluded={excluded}
            onToggleExcluded={toggleExcluded}
            onPlanMeal={() => setPlanMealOpen(true)}
            onShare={() => setShareTarget({ meal: null, entries })}
            canShare={entries.length > 0}
          />
        )}
        <CyclePhaseBadge dateStr={dateStr} days={cycleDays} cycleSettings={settings.cycle} kcalDelta={cycleKcalDelta} favorites={favorites} />
        <TodayOverviewCard
          consumed={totals.kcal}
          goal={daySettings.goal_kcal}
          prot={totals.prot}
          gluc={totals.gluc}
          lip={totals.lip}
          fib={totals.fib}
          goals={daySettings}
          onNavigate={onNavigate}
        />
        <NutrientPanel totals={totals} hasEntries={entries.length > 0} entries={entries} onUpdate={handleUpdate} highlightKeys={microFocusKeys} />

        {/* Uniquement sur le jour réellement affiché (le texte de la bande et
            les favoris/récents qu'elle charge n'ont de sens que pour
            "aujourd'hui" au sens propre, pas un slot voisin visité en
            swipant), et seulement si l'utilisatrice ne l'a pas masquée depuis
            Profil > Page du jour. */}
        {isToday && settings.afficher_manques_jour !== false && (
          <div style={{ marginTop: 16 }}>
            <TodayGapsSection
              dateStr={dateStr}
              gaps={gaps}
              allGaps={allGaps}
              top10Gaps={top10Gaps}
              entries={entries}
              remainingKcal={remainingKcal}
              onAddEntry={handleAdd}
            />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="section-title">Repas du jour</div>
          {MEALS.map(m => (
            <MealSection
              key={m}
              name={m}
              entries={entries.filter(e => e.meal === m)}
              target={mealTargets[m]}
              plannedItems={nonMangesPlanifies.filter(r => r.meal === m)}
              onAdd={(meal) => onOpenModal({ meal, addEntry: handleAdd, top10Gaps })}
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
      </>

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

      {planMealOpen && createPortal(
        <PlanMealModal
          defaultDate={date}
          onClose={() => setPlanMealOpen(false)}
          onPlanned={refetchPlanifies}
        />,
        document.body
      )}

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
    // Si le geste démarre dans une bande qui défile horizontalement (ex. les
    // pastilles de nutriments de "À combler aujourd'hui"), on laisse ce
    // défilement natif se faire : sinon le swipe de jour le capte et on
    // change de jour au lieu de faire défiler les pastilles.
    const scroller = e.target?.closest?.('.chip-scroller')
    if (scroller && scroller.scrollWidth > scroller.clientWidth + 1) {
      touchStartX.current = null
      isHorizontal.current = false
      return
    }
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

  // Date à afficher dans l'en-tête global : pendant un swipe, dès qu'on a
  // dépassé le seuil de bascule, on prévisualise déjà le jour voisin (seuil
  // identique à celui qui déclenchera réellement la navigation au relâchement).
  const previewDate = (() => {
    const threshold = window.innerWidth * SWIPE_THRESHOLD
    if (dragPx < -threshold) return dateNext
    if (dragPx > threshold) return datePrev
    return date
  })()

  const setHeaderInfo = useSetTodayHeaderInfo()
  useEffect(() => {
    setHeaderInfo({ active: true, date: previewDate, onNavigate: navigate })
  }, [previewDate, navigate, setHeaderInfo])
  // Ne retire l'info qu'au démontage réel (changement d'onglet) — pas à
  // chaque mise à jour de previewDate, sinon l'en-tête clignote à vide.
  useEffect(() => {
    return () => setHeaderInfo({ active: false, date: null, onNavigate: null })
  }, [setHeaderInfo])

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
          top10Gaps={modal.top10Gaps}
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