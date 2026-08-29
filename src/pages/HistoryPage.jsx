import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useExcludedDaysRange } from '../hooks/useExcludedDays'
import { useMeasurements } from '../hooks/useMeasurements'
import { TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import MacroBar from '../components/MacroBar'
import CalorieRing from '../components/CalorieRing'
import NutrientPanel from '../components/NutrientPanel'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { todayStr } from '../lib/dates'
import { getPeriodBounds, shiftAnchor, dayStatus, eachDay } from '../lib/history'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import CalorieTrendChart from '../components/history/CalorieTrendChart'
import ConsistencyGrid from '../components/history/ConsistencyGrid'
import HistoryStatGrid from '../components/history/HistoryStatGrid'
import MealSplitBar from '../components/history/MealSplitBar'
import WeekdayProfile from '../components/history/WeekdayProfile'
import TopFoods from '../components/history/TopFoods'
import DayCard from '../components/history/DayCard'
import MonthCard from '../components/history/MonthCard'

const TABS = [
  { key: 'semaine', label: 'Semaine' },
  { key: 'mois', label: 'Mois' },
  { key: 'annee', label: 'Année' },
]

const HIST_WINDOW = 365 // jours remontés pour la série en cours + le record

// Somme kcal d'une liste d'entrées journal
const sumKcal = (es) => es.reduce((s, e) => s + (e.energie_kcal || 0), 0)

export default function HistoryPage() {
  const { settings } = useSettings()
  const { user } = useAuth()
  const { entries: measurementEntries } = useMeasurements()

  const [tab, setTab] = useState('semaine')
  const [anchor, setAnchor] = useState(todayStr())
  const [entries, setEntries] = useState([])
  const [prevEntries, setPrevEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [recordStreak, setRecordStreak] = useState(0)
  const [highlightKey, setHighlightKey] = useState(null)
  const [showWeight, setShowWeight] = useState(false)

  const bounds = useMemo(() => getPeriodBounds(tab, anchor), [tab, anchor])
  const prevBounds = useMemo(() => getPeriodBounds(tab, shiftAnchor(tab, anchor, -1)), [tab, anchor])
  const today = todayStr()
  const isCurrentPeriod = bounds.start <= today && today <= bounds.end

  // Jours exclus des stats — période affichée + période précédente (delta).
  const { excludedDates } = useExcludedDaysRange(bounds.start, bounds.end)
  const { excludedDates: prevExcluded } = useExcludedDaysRange(prevBounds.start, prevBounds.end)

  // ── Chargement du journal (période affichée + précédente) ─────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user) { setEntries([]); setPrevEntries([]); setLoading(false); return }
      setLoading(true)
      const [cur, prev] = await Promise.all([
        supabase.from('journal').select('*').eq('user_id', user.id)
          .gte('date', bounds.start).lte('date', bounds.end).order('date', { ascending: true }),
        supabase.from('journal').select('date, energie_kcal').eq('user_id', user.id)
          .gte('date', prevBounds.start).lte('date', prevBounds.end),
      ])
      if (!cancelled) {
        setEntries(cur.data || [])
        setPrevEntries(prev.data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user, bounds.start, bounds.end, prevBounds.start, prevBounds.end])

  // Édition d'une entrée depuis le drill-down nutriment (NutrientBreakdownModal
  // → FoodDetailModal). Même logique que useJournal.updateEntry.
  const handleUpdate = async (id, patch) => {
    const { data, error } = await supabase
      .from('journal').update(patch).eq('id', id).eq('user_id', user.id).select().single()
    if (!error && data) setEntries(es => es.map(x => x.id === id ? data : x))
    return { error }
  }

  // ── Série en cours + record, indépendants de la période affichée ──────────
  const histFrom = useMemo(() => todayStr(-HIST_WINDOW), [])
  const { excludedDates: histExcluded } = useExcludedDaysRange(histFrom, today)

  useEffect(() => {
    let cancelled = false
    const compute = async () => {
      if (!user) { setStreak(0); setRecordStreak(0); return }
      const { data } = await supabase
        .from('journal').select('date, energie_kcal').eq('user_id', user.id).gte('date', histFrom)
      if (cancelled) return
      const byDate = {}
      for (const e of (data || [])) byDate[e.date] = (byDate[e.date] || 0) + (e.energie_kcal || 0)
      const goal = settings.goal_kcal

      // Série en cours : depuis aujourd'hui en remontant.
      let s = 0
      for (let i = 0; i < HIST_WINDOW; i++) {
        const dStr = todayStr(-i)
        if (histExcluded.has(dStr)) continue
        const kcal = byDate[dStr]
        if (!kcal || kcal > goal) break
        s++
      }
      setStreak(s)

      // Record : plus longue série de jours loggés ≤ objectif sur la fenêtre.
      let run = 0, best = 0
      for (const dStr of eachDay(histFrom, today)) {
        if (histExcluded.has(dStr)) continue // ni compté, ni interrompu
        const kcal = byDate[dStr]
        if (kcal && kcal <= goal) { run++; if (run > best) best = run }
        else run = 0
      }
      setRecordStreak(best)
    }
    compute()
    return () => { cancelled = true }
  }, [user, settings.goal_kcal, histFrom, histExcluded])

  // ── Agrégats de la période ───────────────────────────────────────────────
  const days = useMemo(() => {
    const g = {}
    for (const e of entries) (g[e.date] ||= []).push(e)
    return g
  }, [entries])
  const dateKeys = Object.keys(days).sort((a, b) => b.localeCompare(a))
  const daysWithData = dateKeys.length
  const hasEntries = daysWithData > 0

  const statusByDate = useMemo(() => {
    const m = {}
    for (const d of dateKeys) m[d] = dayStatus(sumKcal(days[d]), settings.goal_kcal)
    return m
  }, [dateKeys, days, settings.goal_kcal])

  const statDateKeys = useMemo(() => dateKeys.filter(d => !excludedDates.has(d)), [dateKeys, excludedDates])
  const daysCounted = statDateKeys.length

  // Jours calendaires de la période (bornés à aujourd'hui pour la période courante)
  const periodDays = useMemo(
    () => eachDay(bounds.start, bounds.end < today ? bounds.end : today).length,
    [bounds.start, bounds.end, today],
  )

  // Moyenne / jour sur les jours loggés ET non exclus (même construction que le
  // `totals` de TodayPage : somme brute par clé, fusion des colonnes dédoublées
  // laissée à NutrientPanel).
  const avg = useMemo(() => {
    const n = daysCounted || 1
    const obj = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 }
    for (const key of ALL_NUTRIENT_KEYS) obj[key] = 0
    for (const e of entries) {
      if (excludedDates.has(e.date)) continue
      obj.kcal += e.energie_kcal || 0
      obj.prot += e.proteines || 0
      obj.gluc += e.glucides || 0
      obj.lip  += e.lipides || 0
      obj.fib  += e.fibres || 0
      for (const key of ALL_NUTRIENT_KEYS) obj[key] += e[key] || 0
    }
    for (const key in obj) obj[key] /= n
    return obj
  }, [entries, daysCounted, excludedDates])

  const daysObjectif = statDateKeys.filter(d => sumKcal(days[d]) <= settings.goal_kcal).length
  const energyBalance = statDateKeys.reduce((s, d) => s + (sumKcal(days[d]) - settings.goal_kcal), 0)

  // Delta moy. kcal/j vs période précédente (jours loggés & non exclus)
  const deltaPrev = useMemo(() => {
    const byDate = {}
    for (const e of prevEntries) byDate[e.date] = (byDate[e.date] || 0) + (e.energie_kcal || 0)
    const dks = Object.keys(byDate).filter(d => !prevExcluded.has(d))
    if (!dks.length || !daysCounted) return null
    const prevAvg = dks.reduce((s, d) => s + byDate[d], 0) / dks.length
    return avg.kcal - prevAvg
  }, [prevEntries, prevExcluded, avg.kcal, daysCounted])

  // Résumés mensuels (onglet Année) — jours exclus ignorés.
  const monthSummaries = useMemo(() => {
    if (tab !== 'annee') return []
    const byMonth = {}
    for (const e of entries) {
      if (excludedDates.has(e.date)) continue
      const m = e.date.slice(0, 7)
      if (!byMonth[m]) byMonth[m] = { kcal: 0, dates: new Set() }
      byMonth[m].kcal += (e.energie_kcal || 0)
      byMonth[m].dates.add(e.date)
    }
    return Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map(m => ({
      key: m,
      label: new Date(m + '-01T12:00:00').toLocaleDateString('fr-FR', { month: 'long' }),
      avgKcal: byMonth[m].kcal / byMonth[m].dates.size,
      daysLogged: byMonth[m].dates.size,
    }))
  }, [tab, entries, excludedDates])

  // ── Points de poids alignés sur la période (superposition graphique) ──────
  const weightPoints = useMemo(() => {
    const inRange = measurementEntries
      .filter(e => e.poids_kg != null && e.date >= bounds.start && e.date <= bounds.end)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (tab !== 'annee') return inRange.map(e => ({ key: e.date, value: e.poids_kg }))
    // Année : dernier relevé de chaque mois, clé = 'YYYY-MM'
    const byMonth = {}
    for (const e of inRange) byMonth[e.date.slice(0, 7)] = e.poids_kg
    return Object.entries(byMonth).map(([key, value]) => ({ key, value }))
  }, [measurementEntries, bounds.start, bounds.end, tab])

  const goPrev = () => setAnchor(a => shiftAnchor(tab, a, -1))
  const goNext = () => setAnchor(a => shiftAnchor(tab, a, 1))
  const changeTab = (t) => { setTab(t); setAnchor(todayStr()); setHighlightKey(null) }

  // « Détail ↓ » du graphe / clic sur une case du calendrier → scroll + halo
  // sur la carte jour/mois correspondante.
  const handleJump = useCallback((key) => {
    const id = tab === 'annee' ? `hist-month-${key}` : `hist-day-${key}`
    setHighlightKey(key)
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    window.clearTimeout(handleJump._t)
    handleJump._t = window.setTimeout(() => setHighlightKey(null), 1400)
  }, [tab])

  return (
    <div className="page-content">
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Historique</div>

      {/* Sélecteur de période */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className="chip"
            style={{
              flex: 1, textAlign: 'center',
              background: tab === t.key ? 'var(--green)' : 'var(--green-light)',
              color: tab === t.key ? 'white' : 'var(--green-dark)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Navigateur de période */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button onClick={goPrev} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: 'var(--text)' }} aria-label="Période précédente">
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{bounds.label}</div>
        <button
          onClick={goNext}
          disabled={isCurrentPeriod}
          style={{ background: 'none', border: 'none', padding: 8, cursor: isCurrentPeriod ? 'default' : 'pointer', color: 'var(--text)', opacity: isCurrentPeriod ? 0.3 : 1 }}
          aria-label="Période suivante"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      {!isCurrentPeriod && (
        <button onClick={() => setAnchor(todayStr())} style={{ display: 'block', margin: '0 auto 16px', fontSize: 12, color: 'var(--green)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
          Revenir à aujourd'hui
        </button>
      )}
      {isCurrentPeriod && <div style={{ marginBottom: 16 }} />}

      {loading && <Loader />}

      {!loading && !hasEntries && (
        <EmptyState icon={<TrendingDown size={40} />} title="Aucune donnée sur cette période" description="Logge tes repas pour voir tes stats ici" />
      )}

      {!loading && hasEntries && (
        <>
          {/* Tendance */}
          <CalorieTrendChart
            tab={tab}
            bounds={bounds}
            days={days}
            goalKcal={settings.goal_kcal}
            excludedDates={excludedDates}
            monthSummaries={monthSummaries}
            avgKcal={avg.kcal}
            weightPoints={weightPoints}
            showWeight={showWeight}
            onToggleWeight={() => setShowWeight(v => !v)}
            onJumpToDetail={handleJump}
          />

          {/* Détail nutritionnel (vitamines, minéraux, sucres, acides gras) */}
          <div className="section-title">Détail nutritionnel</div>
          <NutrientPanel totals={avg} hasEntries={hasEntries} entries={entries} onUpdate={handleUpdate} />

          {/* Stats clés */}
          <HistoryStatGrid
            avgKcal={avg.kcal}
            deltaPrev={deltaPrev}
            daysObjectif={daysObjectif}
            daysCounted={daysCounted}
            daysWithData={daysWithData}
            periodDays={periodDays}
            energyBalance={energyBalance}
            streak={streak}
            recordStreak={recordStreak}
          />
          <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '8px 2px 16px' }}>
            Moyennes calculées sur les {daysCounted} jour{daysCounted > 1 ? 's' : ''} loggé{daysCounted > 1 ? 's' : ''} de la période{daysWithData > daysCounted ? ` (${daysWithData - daysCounted} exclu${daysWithData - daysCounted > 1 ? 's' : ''})` : ''} — comparées aux repères Anses pour un adulte.
          </div>

          {/* Régularité */}
          {(tab === 'mois' || tab === 'annee') && (
            <>
              <div className="section-title">Régularité</div>
              <ConsistencyGrid
                layout={tab === 'annee' ? 'year' : 'month'}
                statusByDate={statusByDate}
                excludedDates={excludedDates}
                monthDate={new Date(anchor + 'T12:00:00')}
                year={Number(bounds.start.slice(0, 4))}
                onSelectDate={handleJump}
              />
            </>
          )}

          {/* Moyennes */}
          <div className="section-title">Moyennes de la période</div>
          <CalorieRing consumed={avg.kcal} goal={settings.goal_kcal} />
          <MacroBar prot={avg.prot} gluc={avg.gluc} lip={avg.lip} fib={avg.fib} goals={settings} />

          {/* Tops & profils */}
          <div className="section-title">Répartition par repas</div>
          <MealSplitBar entries={entries} daysCounted={daysCounted} excludedDates={excludedDates} />

          <div className="section-title">Profil par jour de semaine</div>
          <WeekdayProfile days={days} excludedDates={excludedDates} goalKcal={settings.goal_kcal} />

          <div className="section-title">Aliments les plus fréquents</div>
          <TopFoods entries={entries} />

          {/* Détail */}
          <div className="section-title">{tab === 'annee' ? 'Détail par mois' : 'Détail par jour'}</div>
          {tab === 'annee'
            ? monthSummaries.map(m => (
                <MonthCard
                  key={m.key} monthKey={m.key} monthLabel={m.label}
                  avgKcal={m.avgKcal} daysLogged={m.daysLogged}
                  goalKcal={settings.goal_kcal} highlight={highlightKey === m.key}
                />
              ))
            : dateKeys.map(d => (
                <DayCard
                  key={d} dateStr={d} entries={days[d]} goalKcal={settings.goal_kcal}
                  excluded={excludedDates.has(d)} highlight={highlightKey === d}
                />
              ))}
        </>
      )}
    </div>
  )
}
