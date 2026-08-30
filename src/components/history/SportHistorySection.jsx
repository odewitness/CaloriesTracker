import React, { useMemo } from 'react'
import { Dumbbell, Timer, Flame } from 'lucide-react'
import { eachDay } from '../../lib/history'
import { weekStart, streakWeeks, formatDuree } from '../../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportHistorySection — récap sport de la période affichée dans l'Historique.
// Minutes & séances, moyenne par séance, série de semaines dans l'objectif, et
// un petit histogramme (par jour en vue Semaine, par semaine en vue Mois, par
// mois en vue Année). Aucun jugement : c'est un miroir, pas une note.
//
// Props :
//   activites   — séances de la période (chacune { date, duree_min, ... })
//   streakRows  — séances des ~16 dernières semaines (pour la série)
//   tab         — 'semaine' | 'mois' | 'annee'
//   bounds      — { start, end } 'YYYY-MM-DD'
//   goalMin     — settings.sport.objectif_hebdo_minutes (0 = pas d'objectif)
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function SportHistorySection({ activites = [], streakRows = [], tab, bounds, goalMin = 0 }) {
  const totalMin = activites.reduce((s, a) => s + (Number(a.duree_min) || 0), 0)
  const seances = activites.length
  const streak = useMemo(
    () => streakWeeks(streakRows, bounds.end, goalMin),
    [streakRows, bounds.end, goalMin],
  )

  const buckets = useMemo(() => {
    if (tab === 'annee') {
      return MONTH_INITIALS.map((label, i) => {
        const mm = String(i + 1).padStart(2, '0')
        return { key: mm, label, minutes: activites.reduce((s, a) => s + (a.date.slice(5, 7) === mm ? (Number(a.duree_min) || 0) : 0), 0) }
      })
    }
    if (tab === 'mois') {
      const wk = {}
      for (const d of eachDay(bounds.start, bounds.end)) wk[weekStart(d)] = 0
      for (const a of activites) {
        const ws = weekStart(a.date)
        if (ws in wk) wk[ws] += Number(a.duree_min) || 0
      }
      return Object.keys(wk).sort().map((k, i) => ({ key: k, label: `S${i + 1}`, minutes: wk[k] }))
    }
    // semaine : un bar par jour
    return eachDay(bounds.start, bounds.end).map((d) => {
      const wd = (new Date(d + 'T12:00:00').getDay() + 6) % 7
      return { key: d, label: WEEKDAY_INITIALS[wd], minutes: activites.reduce((s, a) => s + (a.date === d ? (Number(a.duree_min) || 0) : 0), 0) }
    })
  }, [activites, tab, bounds.start, bounds.end])

  const maxMin = Math.max(1, ...buckets.map((b) => b.minutes))

  const tiles = [
    { icon: <Timer size={16} />, color: 'var(--green)', val: formatDuree(totalMin), label: 'Temps total' },
    { icon: <Dumbbell size={16} />, color: 'var(--blue)', val: `${seances}`, label: seances > 1 ? 'Séances' : 'Séance' },
    { icon: <Flame size={16} />, color: 'var(--amber)', val: seances ? formatDuree(totalMin / seances) : '—', label: 'Moy. / séance' },
  ]
  if (goalMin > 0) {
    tiles.push({ icon: <Dumbbell size={16} />, color: 'var(--purple)', val: `${streak}`, label: streak > 1 ? 'Semaines de suite' : 'Semaine de suite' })
  }

  if (seances === 0) {
    return (
      <>
        <div className="section-title">Sport</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          Aucune séance notée sur cette période.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="section-title">Sport</div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 8, marginBottom: 10 }}>
        {tiles.map((t) => (
          <div key={t.label} className="card" style={{ padding: '12px 8px', textAlign: 'center' }}>
            <div style={{ color: t.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{t.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{t.val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '14px 12px 10px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: buckets.length > 12 ? 2 : 4, height: 88 }}>
          {buckets.map((b) => (
            <div key={b.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <div
                  title={`${Math.round(b.minutes)} min`}
                  style={{
                    width: '72%', minWidth: 3,
                    height: `${Math.round((b.minutes / maxMin) * 100)}%`,
                    minHeight: b.minutes > 0 ? 3 : 0,
                    background: 'var(--green)', opacity: b.minutes > 0 ? 0.85 : 0,
                    borderRadius: '3px 3px 0 0', transition: 'height .3s',
                  }}
                />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-hint)', marginTop: 4, whiteSpace: 'nowrap' }}>{b.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 8, textAlign: 'center' }}>
          Minutes actives {tab === 'annee' ? 'par mois' : tab === 'mois' ? 'par semaine' : 'par jour'}
        </div>
      </div>
    </>
  )
}
