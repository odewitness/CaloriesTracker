import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../hooks/useSettings'
import { TrendingDown, Flame, Target } from 'lucide-react'

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
      {/* progress bar */}
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const { settings } = useSettings()
  const [days, setDays] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const from = new Date(); from.setDate(from.getDate() - 30)
      const { data } = await supabase.from('journal').select('*').gte('date', from.toISOString().slice(0, 10)).order('date', { ascending: false })
      const grouped = {}
      for (const e of (data || [])) {
        if (!grouped[e.date]) grouped[e.date] = []
        grouped[e.date].push(e)
      }
      setDays(grouped)
      setLoading(false)
    }
    load()
  }, [])

  const dateKeys = Object.keys(days).sort((a, b) => b.localeCompare(a))

  // Stats
  const allDays = dateKeys.map(d => ({ kcal: days[d].reduce((s, e) => s + (e.energie_kcal || 0), 0) }))
  const avgKcal = allDays.length ? Math.round(allDays.reduce((s, d) => s + d.kcal, 0) / allDays.length) : 0
  const daysUnder = allDays.filter(d => d.kcal <= settings.goal_kcal).length
  const streak = (() => {
    let s = 0
    const today = new Date().toISOString().slice(0, 10)
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const kcal = (days[key] || []).reduce((t, e) => t + (e.energie_kcal || 0), 0)
      if (!kcal) break
      if (kcal <= settings.goal_kcal) s++
      else break
    }
    return s
  })()

  return (
    <div className="page-content">
      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Historique</div>

      {/* Stats summary */}
      {dateKeys.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { icon: <Flame size={18} />, val: avgKcal, label: 'Moy. kcal/j', color: 'var(--amber)' },
            { icon: <Target size={18} />, val: `${daysUnder}j`, label: 'Jours objectif', color: 'var(--green)' },
            { icon: <TrendingDown size={18} />, val: `${streak}j`, label: 'Série en cours', color: 'var(--blue)' },
          ].map(({ icon, val, label, color }) => (
            <div key={label} className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ color, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

      {!loading && dateKeys.length === 0 && (
        <div className="empty">
          <TrendingDown size={40} />
          <div style={{ marginTop: 8, fontWeight: 600 }}>Aucun historique</div>
          <div style={{ marginTop: 4 }}>Commence à logger tes repas pour voir tes stats ici</div>
        </div>
      )}

      {dateKeys.map(d => <DayCard key={d} dateStr={d} entries={days[d]} goalKcal={settings.goal_kcal} />)}
    </div>
  )
}
