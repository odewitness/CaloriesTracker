import React, { useMemo } from 'react'
import { ChevronRight, Dumbbell, Footprints } from 'lucide-react'
import CalorieRing from './CalorieRing'
import MacroBar from './MacroBar'
import PlannedMealCard from './PlannedMealCard'
import ExcludeDayBanner from './ExcludeDayBanner'
import { SUPPLEMENT_MEAL } from './SupplementSection'
import Loader from './Loader'
import { useJournal } from '../hooks/useJournal'
import { useExcludedDay } from '../hooks/useExcludedDays'
import { useSettings } from '../hooks/useSettings'
import { useCycle } from '../hooks/useCycle'
import { useSport } from '../hooks/useSport'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { usePlannedMealsForDate, deletePlannedMeal, deletePlannedMealSeries, markAsEaten } from '../hooks/usePlannedMeals'
import { computeTotals, MEALS_ORDER as MEALS } from '../lib/nutrients'
import { cycleInfo, PHASES } from '../lib/cycle'
import { formatDuree, sportTypeEmoji } from '../lib/sport'
import { isWaterEntry, waterTotalMl, litres } from '../lib/water'
import { fmt, dateLabel } from '../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// DayRecapPanel — aperçu LÉGER d'une date choisie dans le calendrier. Volon­tai­re­ment
// pas une copie de la page du jour : un instantané en lecture seule (bilan
// calories/macros, résumé par repas, phase de cycle et activité si suivies) +
// le bouton « Ouvrir cette journée » qui renvoie vers la page du jour pour tout
// le détail et l'édition. La seule action gardée en ligne est « Marquer mangé »
// sur les repas / compléments encore planifiés, propre au calendrier.
//
// Props :
//   date            — Date sélectionnée
//   onPlannedChange() — notifie le calendrier qu'un repas planifié a changé
//   onExcludedChange() — notifie le calendrier qu'un jour a été (ré)inclus
//   onOpenDay()     — ouvre la page du jour sur cette date
// ─────────────────────────────────────────────────────────────────────────────
export default function DayRecapPanel({ date, onPlannedChange, onExcludedChange, onOpenDay }) {
  const dateStr = fmt(date)
  const { user } = useAuth()
  const toast = useToast()
  const { entries, loading, refetch: refetchJournal } = useJournal(dateStr)
  const { excluded, toggle: toggleExcluded } = useExcludedDay(dateStr)
  const { settings } = useSettings()
  const { repas: repasPlanifies, refetch: refetchPlanifies } = usePlannedMealsForDate(dateStr)
  const { days: cycleDays } = useCycle()
  const { activites: sportActivites, pasJour } = useSport(dateStr)

  const totals = useMemo(() => computeTotals(entries), [entries])
  const nonMangesPlanifies = useMemo(() => repasPlanifies.filter(r => !r.mange), [repasPlanifies])
  const foodEntries = useMemo(() => entries.filter(e => !isWaterEntry(e)), [entries])

  const mealSummary = useMemo(() => MEALS
    .map(m => {
      const es = foodEntries.filter(e => e.meal === m)
      return { meal: m, count: es.length, kcal: es.reduce((s, e) => s + (e.energie_kcal || 0), 0) }
    })
    .filter(x => x.count > 0), [foodEntries])
  const supplementCount = useMemo(() => foodEntries.filter(e => e.meal === SUPPLEMENT_MEAL).length, [foodEntries])
  const waterMl = useMemo(() => waterTotalMl(entries), [entries])

  const cycleLine = useMemo(() => {
    if (!settings.cycle?.enabled || !cycleDays?.length) return null
    const info = cycleInfo(dateStr, cycleDays, settings.cycle)
    if (!info || info.phase === 'inconnue') return null
    const p = PHASES[info.phase]
    return { label: p.label, emoji: p.emoji, color: p.color, jour: info.jourCycle }
  }, [settings.cycle, cycleDays, dateStr])

  const sportLine = useMemo(() => {
    if (!settings.sport?.enabled) return null
    const nb = sportActivites.length
    const min = sportActivites.reduce((s, a) => s + (Number(a.duree_min) || 0), 0)
    const showPas = !!settings.sport?.afficher_pas && pasJour != null
    if (!nb && !showPas) return null
    return {
      nb, min,
      pas: showPas ? pasJour : null,
      emojis: sportActivites.slice(0, 3).map(a => sportTypeEmoji(a.type)),
    }
  }, [settings.sport, sportActivites, pasJour])

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

  if (loading) return <Loader />

  const nothingLogged = mealSummary.length === 0 && supplementCount === 0 && waterMl === 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, textTransform: 'capitalize' }}>{dateLabel(date)}</div>
        {onOpenDay && (
          <button
            onClick={onOpenDay}
            style={{
              display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
              background: 'none', border: 'none', color: 'var(--green)',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            Ouvrir cette journée <ChevronRight size={15} />
          </button>
        )}
      </div>

      <ExcludeDayBanner excluded={excluded} onToggle={async () => { await toggleExcluded(); onExcludedChange?.() }} />

      {(cycleLine || sportLine) && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cycleLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cycleLine.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{cycleLine.emoji} {cycleLine.label}</span>
              <span style={{ color: 'var(--text-hint)' }}>· J{cycleLine.jour}</span>
            </div>
          )}
          {sportLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
              <Dumbbell size={14} color="var(--green)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>
                {sportLine.nb > 0
                  ? `${sportLine.emojis.join(' ')} ${sportLine.nb} séance${sportLine.nb > 1 ? 's' : ''} · ${formatDuree(sportLine.min)}`
                  : 'Pas de séance'}
              </span>
              {sportLine.pas != null && (
                <span style={{ color: 'var(--text-hint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  · <Footprints size={13} /> {sportLine.pas.toLocaleString('fr-FR')} pas
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <CalorieRing consumed={totals.kcal} goal={settings.goal_kcal} />
      <MacroBar prot={totals.prot} gluc={totals.gluc} lip={totals.lip} fib={totals.fib} goals={settings} />

      {nonMangesPlanifies.length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 12 }}>
          <div className="section-title">Prévu ce jour-là</div>
          {nonMangesPlanifies.map(r => (
            <PlannedMealCard
              key={r.id}
              repas={r}
              onMarkEaten={handleMarkEaten}
              onDelete={handleDeletePlanifie}
              onDeleteSeries={handleDeleteSeries}
            />
          ))}
        </div>
      )}

      <div className="card" style={{ padding: '2px 0 6px', marginBottom: 12 }}>
        <div className="section-title" style={{ padding: '10px 14px 4px', marginBottom: 0 }}>Repas du jour</div>
        {nothingLogged ? (
          <div style={{ padding: '4px 14px 10px', fontSize: 13, color: 'var(--text-hint)' }}>
            Rien de noté ce jour-là.
          </div>
        ) : (
          <>
            {mealSummary.map(({ meal, count, kcal }) => (
              <SummaryRow key={meal} label={meal} value={`${count} aliment${count > 1 ? 's' : ''} · ${Math.round(kcal)} kcal`} />
            ))}
            {supplementCount > 0 && (
              <SummaryRow label="Compléments" value={`${supplementCount} pris`} />
            )}
            {waterMl > 0 && (
              <SummaryRow label="Eau" value={`${litres(waterMl)} L`} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '7px 14px' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{value}</span>
    </div>
  )
}
