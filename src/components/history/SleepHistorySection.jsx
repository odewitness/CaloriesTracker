import React, { useMemo } from 'react'
import { Moon, Clock, Sunrise, Smile, CalendarCheck, BatteryLow } from 'lucide-react'
import {
  sleepPeriodStats, sleepRegularityIndex, sriLabel, socialJetlag, chronotype,
  durationByWeekday, bedOffset, wakeOffset, minToTime, offsetToTime,
  formatDureeSommeil, formatEcart, sleepQualite,
} from '../../lib/sleep'

// ─────────────────────────────────────────────────────────────────────────────
// SleepHistorySection — onglet « Sommeil » de l'Historique (chantier suivi du
// sommeil, Palier 2 — voir docs/suivi-sommeil.md). Suit le sélecteur
// Semaine / Mois / Année. Aucun jugement : pas de rouge, pas de score global
// (durée, qualité et régularité restent séparées).
//
// Props :
//   nights         — nuits de la période (une par date de réveil)
//   periodDayKeys  — jours calendaires de la période, bornés à aujourd'hui
//   tab            — 'semaine' | 'mois' | 'annee'
//   objectifMin    — settings.sommeil.objectif_min
// ─────────────────────────────────────────────────────────────────────────────
export default function SleepHistorySection({ nights = [], periodDayKeys = [], tab, objectifMin = 480 }) {
  const stats = useMemo(() => sleepPeriodStats(nights), [nights])
  const sri = useMemo(() => sleepRegularityIndex(nights), [nights])
  const jetlag = useMemo(() => socialJetlag(nights), [nights])
  const chrono = useMemo(() => chronotype(jetlag), [jetlag])

  if (!nights.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 2px 16px', lineHeight: 1.6 }}>
        Aucune nuit notée sur cette période. Note ta nuit chaque matin depuis la carte <strong>Sommeil</strong> de la page du jour :
        le bouton « Comme d'habitude » le fait en un appui.
      </div>
    )
  }

  const q = stats.meanQual != null ? sleepQualite(Math.round(stats.meanQual)) : null
  const ecart = stats.meanDur - objectifMin
  const tiles = [
    { icon: <Moon size={16} />, color: 'var(--purple)', val: formatDureeSommeil(stats.meanDur), label: 'Durée moyenne', sub: `${formatEcart(ecart)} vs objectif` },
    { icon: <Smile size={16} />, color: 'var(--purple)', val: q ? `${q.emoji} ${stats.meanQual.toFixed(1).replace('.', ',')}` : '—', label: 'Qualité ressentie', sub: q ? 'sur 5' : 'non notée' },
    { icon: <Clock size={16} />, color: 'var(--blue)', val: stats.bed ? minToTime(stats.bed.mean) : '—', label: 'Endormissement moyen', sub: stats.bed && stats.bed.n >= 3 ? `± ${Math.round(stats.bed.sd)} min` : null },
    { icon: <Sunrise size={16} />, color: 'var(--amber)', val: stats.wake ? minToTime(stats.wake.mean) : '—', label: 'Réveil moyen', sub: stats.wake && stats.wake.n >= 3 ? `± ${Math.round(stats.wake.sd)} min` : null },
    { icon: <BatteryLow size={16} />, color: 'var(--text-muted)', val: stats.nShort, label: 'Nuits de moins de 6 h' },
    { icon: <CalendarCheck size={16} />, color: 'var(--green)', val: `${stats.n}/${periodDayKeys.length || stats.n}`, label: 'Nuits notées' },
  ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
        {tiles.map(c => (
          <div key={c.label} className="card" style={{ padding: '12px 12px', textAlign: 'center' }}>
            <div style={{ color: c.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{c.label}</div>
            {c.sub && <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 2, fontWeight: 600 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Régularité ── */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--purple)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Régularité</div>
        {sri ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--purple)', fontSize: 15 }}>{sri.sri}</strong>/100 · {sriLabel(sri.sri)}.
            <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 4, lineHeight: 1.4 }}>
              Probabilité d'être dans le même état (endormie ou réveillée) à la même heure d'un jour sur l'autre.
              Des horaires réguliers comptent autant que la durée pour la santé. Sur {sri.pairs} paires de nuits consécutives.
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Note au moins 6 nuits d'affilée avec tes heures d'endormissement et de réveil pour voir ta régularité.
          </div>
        )}
        {stats.efficiency != null && stats.efficiency < 0.85 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
            Tu passes en moyenne <strong>{Math.round((1 - stats.efficiency) * 100)} %</strong> de ta nuit éveillée.
          </div>
        )}
      </div>

      {/* ── Nuits, une barre par nuit (semaine/mois) ou moyennes par mois (année) ── */}
      <div className="section-title">{tab === 'annee' ? 'Durée moyenne par mois' : 'Tes nuits'}</div>
      {tab === 'annee'
        ? <MonthlyBars nights={nights} objectifMin={objectifMin} />
        : <Actogram nights={nights} dayKeys={periodDayKeys} />}

      {/* ── Semaine vs jours libres, chronotype ── */}
      {jetlag && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--blue)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
            {jetlag.basis === 'alarme' ? 'Avec ou sans alarme' : 'Semaine et week-end'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Milieu de ta nuit : <strong>{offsetToTime(jetlag.freeMid)}</strong>{' '}
            {jetlag.basis === 'alarme' ? 'sans alarme' : 'le week-end'} vs <strong>{offsetToTime(jetlag.workMid)}</strong>{' '}
            {jetlag.basis === 'alarme' ? 'avec alarme' : 'en semaine'}, soit un décalage de{' '}
            <strong>{formatDureeSommeil(Math.abs(jetlag.diffMin))}</strong>.
            Tu dors <strong>{formatDureeSommeil(jetlag.freeDur)}</strong> vs <strong>{formatDureeSommeil(jetlag.workDur)}</strong>.
            {Math.abs(jetlag.diffMin) >= 60 && (
              <> Au-delà d'une heure, c'est un petit « décalage horaire » à chaque début de semaine (on parle de <em>jet lag social</em>) : il est associé à plus de fatigue et à un poids plus élevé.</>
            )}
          </div>
          {chrono && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              Ton rythme naturel : <strong>{chrono.label.toLowerCase()}</strong> (milieu de nuit spontané vers {chrono.mid}).
            </div>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
            Sur {jetlag.nFree} + {jetlag.nWork} nuits avec heures notées.
            {jetlag.basis === 'weekend' && ' Coche « sans alarme » dans ta nuit pour une comparaison plus juste.'}
          </div>
        </div>
      )}

      {tab !== 'semaine' && nights.length >= 7 && (
        <>
          <div className="section-title">Par jour de réveil</div>
          <WeekdayBars nights={nights} objectifMin={objectifMin} />
        </>
      )}
    </>
  )
}

// ── Une ligne par nuit, barre de l'endormissement au réveil (20:00 → 12:00) ──
// Plus la barre est foncée, meilleure était la qualité ressentie. Les nuits
// notées sans heures affichent seulement leur durée.
const AXIS_START = 480   // 20:00 en « minutes depuis midi la veille »
const AXIS_END = 1440    // 12:00 le jour du réveil
const AXIS_TICKS = [{ o: 480, l: '20h' }, { o: 720, l: '0h' }, { o: 960, l: '4h' }, { o: 1200, l: '8h' }, { o: 1440, l: '12h' }]

function Actogram({ nights, dayKeys }) {
  const byDate = new Map(nights.map(n => [n.date, n]))
  const pct = (o) => ((Math.min(AXIS_END, Math.max(AXIS_START, o)) - AXIS_START) / (AXIS_END - AXIS_START)) * 100
  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', marginLeft: 44, marginRight: 40, position: 'relative', height: 12, marginBottom: 4 }}>
        {AXIS_TICKS.map(t => (
          <span key={t.o} style={{ position: 'absolute', left: `${pct(t.o)}%`, transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-hint)' }}>{t.l}</span>
        ))}
      </div>
      {dayKeys.map(d => {
        const n = byDate.get(d)
        const b = n ? bedOffset(n.heure_endormissement) : null
        const w = n ? wakeOffset(n.heure_reveil) : null
        const hasWin = b != null && w != null && b < w
        const q = n?.qualite ? Number(n.qualite) : null
        const dt = new Date(d + 'T12:00:00')
        return (
          <div key={d} style={{ display: 'flex', alignItems: 'center', height: 16 }}>
            <span style={{ width: 44, flexShrink: 0, fontSize: 9.5, color: 'var(--text-muted)' }}>
              {dt.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')} {dt.getDate()}
            </span>
            <div style={{ flex: 1, position: 'relative', height: 8 }}>
              {AXIS_TICKS.map(t => (
                <div key={t.o} style={{ position: 'absolute', left: `${pct(t.o)}%`, top: -4, bottom: -4, borderLeft: '1px solid var(--border)' }} />
              ))}
              {hasWin && (
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, borderRadius: 4,
                  left: `${pct(b)}%`, width: `${Math.max(1, pct(w) - pct(b))}%`,
                  background: 'var(--purple)', opacity: q ? 0.3 + q * 0.14 : 0.55,
                }} />
              )}
            </div>
            <span style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 9.5, color: n ? 'var(--text)' : 'var(--text-hint)', fontWeight: n ? 600 : 400 }}>
              {n ? formatDureeSommeil(n.duree_min).replace(/ /g, '') : '—'}
            </span>
          </div>
        )
      })}
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 8 }}>
        Une ligne par nuit, au jour du réveil · plus foncé = meilleure qualité ressentie
      </div>
    </div>
  )
}

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function MonthlyBars({ nights, objectifMin }) {
  const means = useMemo(() => {
    const sum = Array(12).fill(0), count = Array(12).fill(0)
    for (const n of nights) {
      const m = Number(n.date.slice(5, 7)) - 1
      sum[m] += n.duree_min; count[m]++
    }
    return sum.map((s, i) => (count[i] ? s / count[i] : null))
  }, [nights])
  return <DurationBars values={means} labels={MONTH_INITIALS} objectifMin={objectifMin} caption="Durée moyenne des nuits notées chaque mois · pointillés = objectif" />
}

function WeekdayBars({ nights, objectifMin }) {
  const means = useMemo(() => durationByWeekday(nights), [nights])
  return <DurationBars values={means} labels={['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']} objectifMin={objectifMin} caption="Durée moyenne selon le jour du réveil (« Lun » = nuit du dimanche au lundi)" />
}

function DurationBars({ values, labels, objectifMin, caption }) {
  if (values.every(v => v == null)) return null
  const max = Math.max(objectifMin * 1.2, ...values.map(v => v || 0))
  const H = 90
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, height: H }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: (objectifMin / max) * (H - 14), borderTop: '1px dashed var(--border-md)' }} />
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <span style={{ fontSize: 8.5, color: 'var(--text-hint)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {v ? `${Math.floor(v / 60)}h${String(Math.round(v % 60)).padStart(2, '0')}` : '—'}
            </span>
            <div style={{
              width: '100%', height: v ? (v / max) * (H - 14) : 0, minHeight: v ? 3 : 0,
              background: 'var(--purple)', borderRadius: 3, transition: 'height .4s',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {labels.map((l, i) => (
          <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>{l}</span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 8 }}>{caption}</div>
    </div>
  )
}
