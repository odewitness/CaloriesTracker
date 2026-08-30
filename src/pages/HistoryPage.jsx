import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { useExcludedDaysRange } from '../hooks/useExcludedDays'
import { useMeasurements } from '../hooks/useMeasurements'
import { useCycle } from '../hooks/useCycle'
import { useSportRange, useSportStreak } from '../hooks/useSport'
import { phaseForDate } from '../lib/cycle'
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
import SportHistorySection from '../components/history/SportHistorySection'
import SportPhaseSection from '../components/history/SportPhaseSection'

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
  const { days: cycleDays } = useCycle()
  const { rows: sportStreakRows } = useSportStreak(16)

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

  // Séances de sport + pas de la période affichée (récap dédié, indépendant du
  // journal — s'affiche même sur une période sans aucun repas loggé).
  const { byDate: sportByDate, pasByDate } = useSportRange(bounds.start, bounds.end)
  const sportActs = useMemo(() => Object.values(sportByDate).flat(), [sportByDate])
  const sportDates = useMemo(() => new Set(Object.keys(sportByDate)), [sportByDate])
  const hasSport = !!settings.sport?.enabled && (sportActs.length > 0 || Object.keys(pasByDate).length > 0)

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

  // Corrélation phase ↔ calories / poids sur la période affichée (Palier 5) —
  // hors vue Année (barres mensuelles). Split des jours loggés en "phase
  // lutéale" vs "reste du cycle".
  const cyclePhaseStats = useMemo(() => {
    const cfg = settings.cycle
    if (tab === 'annee' || !cfg?.enabled || cfg.sous_contraception || !cycleDays.length) return null
    const lut = { k: [], w: [], pas: [], dep: [] }, rest = { k: [], w: [], pas: [], dep: [] }
    for (const d of statDateKeys) {
      const kcal = sumKcal(days[d])
      if (kcal <= 0) continue
      const bucket = phaseForDate(d, cycleDays, cfg) === 'luteale' ? lut : rest
      bucket.k.push(kcal)
      const p = pasByDate[d]
      if (p > 0) bucket.pas.push(p)
      const dep = (sportByDate[d] || []).reduce((s, a) => s + (Number(a.energie_kcal) || 0), 0)
      if (dep > 0) bucket.dep.push(dep)
    }
    for (const m of measurementEntries) {
      if (m.poids_kg == null || m.date < bounds.start || m.date > bounds.end) continue
      ;(phaseForDate(m.date, cycleDays, cfg) === 'luteale' ? lut : rest).w.push(m.poids_kg)
    }
    if (lut.k.length < 2 || rest.k.length < 2) return null
    const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
    const kLut = mean(lut.k), kRest = mean(rest.k)
    const wLut = mean(lut.w), wRest = mean(rest.w)
    const pasLut = mean(lut.pas), pasRest = mean(rest.pas)
    const depLut = mean(lut.dep), depRest = mean(rest.dep)
    return {
      kLut: Math.round(kLut), kRest: Math.round(kRest), kDelta: Math.round(kLut - kRest),
      nLut: lut.k.length, nRest: rest.k.length,
      wLut: wLut != null ? Math.round(wLut * 10) / 10 : null,
      wRest: wRest != null ? Math.round(wRest * 10) / 10 : null,
      wDelta: (wLut != null && wRest != null) ? Math.round((wLut - wRest) * 10) / 10 : null,
      pasLut: pasLut != null ? Math.round(pasLut) : null,
      pasRest: pasRest != null ? Math.round(pasRest) : null,
      pasDelta: (pasLut != null && pasRest != null) ? Math.round(pasLut - pasRest) : null,
      depLut: depLut != null ? Math.round(depLut) : null,
      depRest: depRest != null ? Math.round(depRest) : null,
      depDelta: (depLut != null && depRest != null) ? Math.round(depLut - depRest) : null,
    }
  }, [tab, settings.cycle, cycleDays, statDateKeys, days, measurementEntries, bounds.start, bounds.end, pasByDate, sportByDate])

  const daysObjectif = statDateKeys.filter(d => sumKcal(days[d]) <= settings.goal_kcal).length
  const energyBalance = statDateKeys.reduce((s, d) => s + (sumKcal(days[d]) - settings.goal_kcal), 0)

  // Corrélation sport ↔ calories / poids sur la période — jours AVEC séance vs
  // jours SANS (jours loggés & non exclus). Hors vue Année. Min. 2 + 2 jours.
  const sportPeriodStats = useMemo(() => {
    if (tab === 'annee' || !settings.sport?.enabled || sportDates.size === 0) return null
    const withS = { k: [], w: [] }, without = { k: [], w: [] }
    for (const d of statDateKeys) {
      const kcal = sumKcal(days[d])
      if (kcal <= 0) continue
      ;(sportDates.has(d) ? withS : without).k.push(kcal)
    }
    for (const m of measurementEntries) {
      if (m.poids_kg == null || m.date < bounds.start || m.date > bounds.end) continue
      ;(sportDates.has(m.date) ? withS : without).w.push(m.poids_kg)
    }
    if (withS.k.length < 2 || without.k.length < 2) return null
    const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null)
    const kW = mean(withS.k), kO = mean(without.k)
    const wW = mean(withS.w), wO = mean(without.w)
    return {
      kWith: Math.round(kW), kWithout: Math.round(kO), kDelta: Math.round(kW - kO),
      nWith: withS.k.length, nWithout: without.k.length,
      wWith: wW != null ? Math.round(wW * 10) / 10 : null,
      wWithout: wO != null ? Math.round(wO * 10) / 10 : null,
      wDelta: (wW != null && wO != null) ? Math.round((wW - wO) * 10) / 10 : null,
    }
  }, [tab, settings.sport, sportDates, statDateKeys, days, measurementEntries, bounds.start, bounds.end])

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

      {!loading && !hasEntries && !hasSport && (
        <EmptyState icon={<TrendingDown size={40} />} title="Aucune donnée sur cette période" description="Logge tes repas pour voir tes stats ici" />
      )}

      {/* Période sans repas loggé mais avec des séances / des pas : on affiche
          quand même le récap d'activité (indépendant du journal). */}
      {!loading && !hasEntries && hasSport && (
        <>
          <SportHistorySection
            activites={sportActs}
            pasByDate={pasByDate}
            streakRows={sportStreakRows}
            tab={tab}
            bounds={bounds}
            goalMin={Number(settings.sport?.objectif_hebdo_minutes) || 0}
            weightPoints={weightPoints}
            cycleDays={cycleDays}
            cycleSettings={settings.cycle}
          />
          {tab !== 'annee' && settings.cycle?.enabled && (
            <SportPhaseSection activites={sportActs} cycleDays={cycleDays} cycleSettings={settings.cycle} />
          )}
          <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '8px 2px 16px' }}>
            Aucun repas loggé sur cette période — seules tes données d'activité s'affichent.
          </div>
        </>
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
            cycleDays={cycleDays}
            cycleSettings={settings.cycle}
            sportDates={settings.sport?.enabled ? sportDates : undefined}
          />

          {cyclePhaseStats && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--purple)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Ton cycle sur cette période</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Calories moy. : <strong>{cyclePhaseStats.kLut}</strong> en phase lutéale vs{' '}
                <strong>{cyclePhaseStats.kRest}</strong> le reste du cycle{' '}
                (<span style={{ color: cyclePhaseStats.kDelta >= 0 ? 'var(--coral)' : 'var(--green)', fontWeight: 700 }}>
                  {cyclePhaseStats.kDelta >= 0 ? '+' : ''}{cyclePhaseStats.kDelta}
                </span>).
                {cyclePhaseStats.wDelta != null && (
                  <> Poids moy. : <strong>{cyclePhaseStats.wLut}</strong> vs <strong>{cyclePhaseStats.wRest}</strong> kg{' '}
                  ({cyclePhaseStats.wDelta >= 0 ? '+' : ''}{cyclePhaseStats.wDelta}).</>
                )}
              </div>
              {(cyclePhaseStats.pasDelta != null || cyclePhaseStats.depDelta != null) && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                  {cyclePhaseStats.pasDelta != null && (
                    <>Pas moy./j : <strong>{cyclePhaseStats.pasLut.toLocaleString('fr-FR')}</strong> vs{' '}
                    <strong>{cyclePhaseStats.pasRest.toLocaleString('fr-FR')}</strong>{' '}
                    (<span style={{ color: cyclePhaseStats.pasDelta >= 0 ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {cyclePhaseStats.pasDelta >= 0 ? '+' : ''}{cyclePhaseStats.pasDelta.toLocaleString('fr-FR')}
                    </span>).{' '}</>
                  )}
                  {cyclePhaseStats.depDelta != null && (
                    <>Kcal dépensées/j : ≈ <strong>{cyclePhaseStats.depLut}</strong> vs ≈ <strong>{cyclePhaseStats.depRest}</strong>{' '}
                    ({cyclePhaseStats.depDelta >= 0 ? '+' : ''}{cyclePhaseStats.depDelta}).</>
                  )}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
                Un petit écart est attendu ; côté poids c'est surtout de l'eau. Sur {cyclePhaseStats.nLut} + {cyclePhaseStats.nRest} jours notés.
              </div>
            </div>
          )}

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

          {settings.sport?.enabled && (
            <SportHistorySection
              activites={sportActs}
              pasByDate={pasByDate}
              streakRows={sportStreakRows}
              tab={tab}
              bounds={bounds}
              goalMin={Number(settings.sport?.objectif_hebdo_minutes) || 0}
              weightPoints={weightPoints}
              cycleDays={cycleDays}
              cycleSettings={settings.cycle}
            />
          )}

          {sportPeriodStats && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: 16, borderLeft: '3px solid var(--green)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Sport &amp; calories sur cette période</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Calories moy. : <strong>{sportPeriodStats.kWith}</strong> les jours avec séance vs{' '}
                <strong>{sportPeriodStats.kWithout}</strong> les jours sans{' '}
                (<span style={{ color: sportPeriodStats.kDelta >= 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                  {sportPeriodStats.kDelta >= 0 ? '+' : ''}{sportPeriodStats.kDelta}
                </span>).
                {sportPeriodStats.wDelta != null && (
                  <> Poids moy. : <strong>{sportPeriodStats.wWith}</strong> vs <strong>{sportPeriodStats.wWithout}</strong> kg{' '}
                  ({sportPeriodStats.wDelta >= 0 ? '+' : ''}{sportPeriodStats.wDelta}).</>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
                Simple observation, pas une relation de cause à effet. Sur {sportPeriodStats.nWith} + {sportPeriodStats.nWithout} jours notés.
              </div>
            </div>
          )}

          {tab !== 'annee' && settings.sport?.enabled && settings.cycle?.enabled && (
            <SportPhaseSection
              activites={sportActs}
              cycleDays={cycleDays}
              cycleSettings={settings.cycle}
            />
          )}

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
