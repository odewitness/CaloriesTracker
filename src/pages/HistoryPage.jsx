import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { useAuth } from '../lib/AuthContext'
import { TrendingDown, Flame, Target, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import MacroBar from '../components/MacroBar'
import CalorieRing from '../components/CalorieRing'
import NutrientGauges from '../components/NutrientGauges'
import { SucresAnsesGauge, LipidesTotauxGauge, AGSGauge } from '../components/NutrientDetails'
import { VITAMIN_FIELDS, MINERAL_FIELDS } from '../lib/nutrients'

const TABS = [
  { key: 'jour', label: 'Jour' },
  { key: 'semaine', label: 'Semaine' },
  { key: 'mois', label: 'Mois' },
  { key: 'annee', label: 'Année' },
]

const MEAL_ORDER = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Bornes [start, end] (inclus, format YYYY-MM-DD) de la période affichée + libellé FR.
function getPeriodBounds(tab, anchor) {
  const d = new Date(anchor + 'T12:00:00')

  if (tab === 'jour') {
    return { start: anchor, end: anchor, label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  }

  if (tab === 'semaine') {
    const dow = d.getDay() || 7 // lundi=1 ... dimanche=7
    const monday = new Date(d); monday.setDate(d.getDate() - dow + 1)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const fmt = (dt, withYear) => dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined })
    return {
      start: monday.toISOString().slice(0, 10),
      end: sunday.toISOString().slice(0, 10),
      label: `${fmt(monday)} – ${fmt(sunday, true)}`,
    }
  }

  if (tab === 'mois') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
  }

  // année
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()}` }
}

function shiftAnchor(tab, anchor, dir) {
  const d = new Date(anchor + 'T12:00:00')
  if (tab === 'jour') d.setDate(d.getDate() + dir)
  else if (tab === 'semaine') d.setDate(d.getDate() + dir * 7)
  else if (tab === 'mois') d.setMonth(d.getMonth() + dir)
  else d.setFullYear(d.getFullYear() + dir)
  return d.toISOString().slice(0, 10)
}

function DayCard({ dateStr, entries, goalKcal }) {
  const kcal = entries.reduce((s, e) => s + (e.energie_kcal || 0), 0)
  const prot = entries.reduce((s, e) => s + (e.proteines || 0), 0)
  const gluc = entries.reduce((s, e) => s + (e.glucides || 0), 0)
  const lip  = entries.reduce((s, e) => s + (e.lipides || 0), 0)
  const diff = Math.round(kcal - goalKcal)
  const pct  = Math.min(100, (kcal / goalKcal) * 100)
  const color = diff <= 0 ? 'var(--green)' : Math.abs(diff) < 200 ? 'var(--amber)' : 'var(--coral)'

  const d = new Date(dateStr + 'T12:00:00')
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <div className="card" style={{ padding: '13px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 1 }}>{Math.round(kcal)} kcal</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            <span className="c-prot">P {Math.round(prot)}g</span>&nbsp;
            <span className="c-gluc">G {Math.round(gluc)}g</span>&nbsp;
            <span className="c-lip">L {Math.round(lip)}g</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color }}>{diff <= 0 ? `−${Math.abs(diff)}` : `+${diff}`} kcal</div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{entries.length} aliment{entries.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

function MealGroup({ meal, entries }) {
  const kcal = entries.reduce((s, e) => s + (e.energie_kcal || 0), 0)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        <span>{meal || 'Autre'}</span>
        <span>{Math.round(kcal)} kcal</span>
      </div>
      {entries.map(e => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--gray-bg)' }}>
          <span>{e.food_name} <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>· {e.qty_g}g</span></span>
          <span style={{ color: 'var(--text-muted)' }}>{Math.round(e.energie_kcal || 0)} kcal</span>
        </div>
      ))}
    </div>
  )
}

function MonthCard({ monthLabel, avgKcal, daysLogged, goalKcal }) {
  const diff = Math.round(avgKcal - goalKcal)
  const color = diff <= 0 ? 'var(--green)' : Math.abs(diff) < 200 ? 'var(--amber)' : 'var(--coral)'
  return (
    <div className="card" style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel}</div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{daysLogged} jour{daysLogged > 1 ? 's' : ''} loggé{daysLogged > 1 ? 's' : ''}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round(avgKcal)} kcal/j</div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{diff <= 0 ? `−${Math.abs(diff)}` : `+${diff}`} vs objectif</div>
      </div>
    </div>
  )
}

// Carte dépliable "Sucres / Gras / Vitamines / Minéraux" — réutilise les jauges
// déjà construites pour TodayPage (NutrientDetails) et la nouvelle jauge générique
// vitamines/minéraux, nourries avec les totaux moyens de la période sélectionnée.
function NutrientCollapsible({ avg, hasEntries }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('sucres')

  const tabs = [
    { key: 'sucres', label: 'Sucres' },
    { key: 'gras', label: 'Gras' },
    { key: 'vitamines', label: 'Vitamines' },
    { key: 'mineraux', label: 'Minéraux' },
  ]

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Sucres, gras, vitamines & minéraux</span>
        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="chip"
                style={{ background: tab === t.key ? 'var(--green)' : 'var(--green-light)', color: tab === t.key ? 'white' : 'var(--green-dark)' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'sucres' && <SucresAnsesGauge totals={avg} hasEntries={hasEntries} />}
          {tab === 'gras' && (
            <>
              <LipidesTotauxGauge totals={avg} hasEntries={hasEntries} />
              <AGSGauge totals={avg} hasEntries={hasEntries} />
            </>
          )}
          {tab === 'vitamines' && <NutrientGauges fields={VITAMIN_FIELDS} totals={avg} hasEntries={hasEntries} />}
          {tab === 'mineraux' && <NutrientGauges fields={MINERAL_FIELDS} totals={avg} hasEntries={hasEntries} />}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const { settings } = useSettings()
  const { user } = useAuth()

  const [tab, setTab] = useState('jour')
  const [anchor, setAnchor] = useState(todayStr())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)

  const bounds = useMemo(() => getPeriodBounds(tab, anchor), [tab, anchor])
  const today = todayStr()
  const isCurrentPeriod = bounds.start <= today && today <= bounds.end

  // Charge les entrées du journal sur la période sélectionnée
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user) { setEntries([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('journal')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', bounds.start)
        .lte('date', bounds.end)
        .order('date', { ascending: true })
      if (!cancelled) { setEntries(data || []); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [user, bounds.start, bounds.end])

  // Série en cours : indépendante de la période affichée, toujours calculée
  // depuis aujourd'hui en remontant (comme avant).
  useEffect(() => {
    let cancelled = false
    const computeStreak = async () => {
      if (!user) { setStreak(0); return }
      const from = new Date(); from.setDate(from.getDate() - 60)
      const { data } = await supabase
        .from('journal')
        .select('date, energie_kcal')
        .eq('user_id', user.id)
        .gte('date', from.toISOString().slice(0, 10))
      if (cancelled) return
      const byDate = {}
      for (const e of (data || [])) byDate[e.date] = (byDate[e.date] || 0) + (e.energie_kcal || 0)
      let s = 0
      for (let i = 0; i < 60; i++) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const kcal = byDate[d.toISOString().slice(0, 10)]
        if (!kcal) break
        if (kcal <= settings.goal_kcal) s++
        else break
      }
      setStreak(s)
    }
    computeStreak()
    return () => { cancelled = true }
  }, [user, settings.goal_kcal])

  const days = useMemo(() => {
    const g = {}
    for (const e of entries) {
      if (!g[e.date]) g[e.date] = []
      g[e.date].push(e)
    }
    return g
  }, [entries])
  const dateKeys = Object.keys(days).sort((a, b) => b.localeCompare(a))
  const daysWithData = dateKeys.length
  const hasEntries = daysWithData > 0

  // Moyenne / jour sur la période, calculée sur les jours réellement loggés
  // (pas sur le nombre de jours calendaires) pour ne pas fausser la comparaison
  // aux repères Anses si la semaine/le mois n'est pas terminé(e) ou partiellement loggé(e).
const avg = useMemo(() => {
  const sum = (key) => entries.reduce((s, e) => s + (Number(e[key]) || 0), 0)
  const n = daysWithData || 1
  const obj = {
    kcal: sum('energie_kcal') / n,
    prot: sum('proteines') / n,
    gluc: sum('glucides') / n,
    lip: sum('lipides') / n,
    fib: sum('fibres') / n,
    sucres: sum('sucres') / n,
    lactose: sum('lactose') / n,
    galactose: sum('galactose') / n,
    acides_gras_satures: sum('acides_gras_satures') / n,
  }
  // sumKeys : additionne les colonnes équivalentes/dédoublées (ex: folates +
  // folates_intrinseques, vit_e_totale + vit_e) — même logique que VitaminPanel,
  // appliquée ici au niveau de l'agrégation pour que ça marche quel que soit
  // le composant d'affichage utilisé en aval.
  for (const f of VITAMIN_FIELDS) {
    const keys = f.sumKeys || [f.key]
    obj[f.key] = keys.reduce((s, k) => s + sum(k), 0) / n
  }
  for (const f of MINERAL_FIELDS) {
    const keys = f.sumKeys || [f.key]
    obj[f.key] = keys.reduce((s, k) => s + sum(k), 0) / n
  }
  return obj
}, [entries, daysWithData])

  const daysObjectif = dateKeys.filter(d => days[d].reduce((s, e) => s + (e.energie_kcal || 0), 0) <= settings.goal_kcal).length

  const goPrev = () => setAnchor(a => shiftAnchor(tab, a, -1))
  const goNext = () => setAnchor(a => shiftAnchor(tab, a, 1))
  const changeTab = (t) => { setTab(t); setAnchor(todayStr()) }

  // Résumés mensuels pour le drill-down de l'onglet Année
  const monthSummaries = useMemo(() => {
    if (tab !== 'annee') return []
    const byMonth = {}
    for (const e of entries) {
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
  }, [tab, entries])

  // Repas du jour sélectionné, groupés par repas (pour l'onglet Jour)
  const mealGroups = useMemo(() => {
    if (tab !== 'jour') return []
    const byMeal = {}
    for (const e of (days[anchor] || [])) {
      if (!byMeal[e.meal]) byMeal[e.meal] = []
      byMeal[e.meal].push(e)
    }
    return Object.keys(byMeal).sort((a, b) => {
      const ia = MEAL_ORDER.indexOf(a); const ib = MEAL_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    }).map(m => ({ meal: m, entries: byMeal[m] }))
  }, [tab, days, anchor])

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

      {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

      {!loading && !hasEntries && (
        <div className="empty">
          <TrendingDown size={40} />
          <div style={{ marginTop: 8, fontWeight: 600 }}>Aucune donnée sur cette période</div>
          <div style={{ marginTop: 4 }}>Logge tes repas pour voir tes stats ici</div>
        </div>
      )}

      {!loading && hasEntries && (
        <>
          {/* Stats résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
            {[
              { icon: <Flame size={18} />, val: Math.round(avg.kcal), label: 'Moy. kcal/j', color: 'var(--amber)' },
              { icon: <Target size={18} />, val: `${daysObjectif}/${daysWithData}j`, label: 'Jours objectif', color: 'var(--green)' },
              { icon: <TrendingDown size={18} />, val: `${streak}j`, label: 'Série en cours', color: 'var(--blue)' },
            ].map(({ icon, val, label, color }) => (
              <div key={label} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ color, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', margin: '6px 2px 16px' }}>
            Moyennes calculées sur les {daysWithData} jour{daysWithData > 1 ? 's' : ''} loggé{daysWithData > 1 ? 's' : ''} de la période — comparées aux repères Anses pour un adulte.
          </div>

          <CalorieRing consumed={avg.kcal} goal={settings.goal_kcal} />
          <MacroBar prot={avg.prot} gluc={avg.gluc} lip={avg.lip} fib={avg.fib} goals={settings} />
          <NutrientCollapsible avg={avg} hasEntries={hasEntries} />

          {/* Détail */}
          <div style={{ fontWeight: 700, fontSize: 15, margin: '20px 0 10px' }}>
            {tab === 'jour' ? 'Détail des repas' : tab === 'annee' ? 'Détail par mois' : 'Détail par jour'}
          </div>

          {tab === 'jour' && (
            mealGroups.length
              ? <div className="card" style={{ padding: '14px 16px' }}>{mealGroups.map(g => <MealGroup key={g.meal} meal={g.meal} entries={g.entries} />)}</div>
              : <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Rien de loggé ce jour-là.</div>
          )}

          {(tab === 'semaine' || tab === 'mois') && dateKeys.map(d => (
            <DayCard key={d} dateStr={d} entries={days[d]} goalKcal={settings.goal_kcal} />
          ))}

          {tab === 'annee' && monthSummaries.map(m => (
            <MonthCard key={m.key} monthLabel={m.label} avgKcal={m.avgKcal} daysLogged={m.daysLogged} goalKcal={settings.goal_kcal} />
          ))}
        </>
      )}
    </div>
  )
}