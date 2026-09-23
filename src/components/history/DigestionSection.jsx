import React, { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  regularityStats, bristolHistogram, effortStats, alertEntries, remarqueCounts,
  bucketDaysByMetric, dayMeanBristol, dayDifficileRate, medianSplit,
} from '../../lib/digestion'
import { bristolType, stoolRemarqueLabel, formatHeureSelle } from '../../lib/stool'
import { waterTotalMl } from '../../lib/water'
import { phaseForDate } from '../../lib/cycle'

// Carte de corrélation « jours A vs jours B » — même gabarit visuel que les
// cartes sportPeriodStats/cyclePhaseStats de HistoryPage.jsx (borderLeft
// coloré, phrase avec valeurs en gras, disclaimer). Ici la métrique comparée
// est le type Bristol moyen du jour (échelle 1-7), + le taux de passages
// difficiles en 2ᵉ ligne quand disponible.
function CorrelationCard({ color, title, labelA, labelB, stats, effortA, effortB, disclaimer }) {
  if (!stats) return null
  const fmt1 = (v) => Math.round(v * 10) / 10
  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Type Bristol moyen : <strong>{fmt1(stats.meanA)}</strong> {labelA} vs{' '}
        <strong>{fmt1(stats.meanB)}</strong> {labelB}{' '}
        (<span style={{ color: stats.delta === 0 ? 'var(--text-muted)' : 'var(--green)', fontWeight: 700 }}>
          {stats.delta > 0 ? '+' : ''}{fmt1(stats.delta)}
        </span>).
        {effortA != null && effortB != null && (
          <> Passages difficiles : <strong>{Math.round(effortA * 100)} %</strong> vs <strong>{Math.round(effortB * 100)} %</strong>.</>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
        {disclaimer} Sur {stats.nA} + {stats.nB} jours notés.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DigestionSection — onglet « Digestion » de l'Historique. Réservé au compte
// STOOL_TRACKER_USER_ID (gardé par l'appelant, HistoryPage.jsx).
//
// Props :
//   tab             — 'semaine' | 'mois' | 'annee' (corrélations masquées en Année)
//   selles          — passages de la période affichée
//   periodDayKeys   — jours calendaires de la période, jours exclus déjà retirés
//   days            — { dateStr: entrées journal[] } de la période (fibres, eau)
//   cycleDays, cycleSettings, sportDates — mêmes données que le reste d'Historique
// ─────────────────────────────────────────────────────────────────────────────
export default function DigestionSection({ tab, selles, periodDayKeys, days, cycleDays, cycleSettings, sportDates }) {
  const regularity = useMemo(() => regularityStats(selles, periodDayKeys), [selles, periodDayKeys])
  const histogram = useMemo(() => bristolHistogram(selles), [selles])
  const maxCount = Math.max(1, ...histogram.map((h) => h.count))
  const effort = useMemo(() => effortStats(selles), [selles])
  const alerts = useMemo(() => alertEntries(selles), [selles])
  const remarques = useMemo(
    () => remarqueCounts(selles).filter((r) => r.key !== 'sang' && r.key !== 'mucus'),
    [selles],
  )

  // ── Jours → métriques journal (fibres, eau) pour les splits médians ────────
  const fibresByDate = useMemo(() => {
    const m = {}
    for (const d of periodDayKeys) m[d] = (days[d] || []).reduce((s, e) => s + (e.fibres || 0), 0)
    return m
  }, [periodDayKeys, days])
  const waterByDate = useMemo(() => {
    const m = {}
    for (const d of periodDayKeys) m[d] = waterTotalMl(days[d] || [])
    return m
  }, [periodDayKeys, days])

  const showCorrelations = tab !== 'annee'

  const fibresSplit = useMemo(() => (showCorrelations ? medianSplit(fibresByDate) : null), [showCorrelations, fibresByDate])
  const fibresBristol = useMemo(
    () => (fibresSplit ? bucketDaysByMetric(selles, periodDayKeys, (d) => fibresSplit.isHigh(d), dayMeanBristol) : null),
    [fibresSplit, selles, periodDayKeys],
  )
  const fibresEffort = useMemo(
    () => (fibresSplit ? bucketDaysByMetric(selles, periodDayKeys, (d) => fibresSplit.isHigh(d), dayDifficileRate) : null),
    [fibresSplit, selles, periodDayKeys],
  )

  const waterSplit = useMemo(() => (showCorrelations ? medianSplit(waterByDate) : null), [showCorrelations, waterByDate])
  const waterBristol = useMemo(
    () => (waterSplit ? bucketDaysByMetric(selles, periodDayKeys, (d) => waterSplit.isHigh(d), dayMeanBristol) : null),
    [waterSplit, selles, periodDayKeys],
  )
  const waterEffort = useMemo(
    () => (waterSplit ? bucketDaysByMetric(selles, periodDayKeys, (d) => waterSplit.isHigh(d), dayDifficileRate) : null),
    [waterSplit, selles, periodDayKeys],
  )

  const hasSport = showCorrelations && sportDates && sportDates.size > 0
  const sportBristol = useMemo(
    () => (hasSport ? bucketDaysByMetric(selles, periodDayKeys, (d) => sportDates.has(d), dayMeanBristol) : null),
    [hasSport, sportDates, selles, periodDayKeys],
  )
  const sportEffort = useMemo(
    () => (hasSport ? bucketDaysByMetric(selles, periodDayKeys, (d) => sportDates.has(d), dayDifficileRate) : null),
    [hasSport, sportDates, selles, periodDayKeys],
  )

  const hasCycle = showCorrelations && !!cycleSettings?.enabled && !cycleSettings?.sous_contraception && cycleDays?.length > 0
  const cycleBristol = useMemo(
    () => (hasCycle ? bucketDaysByMetric(selles, periodDayKeys, (d) => phaseForDate(d, cycleDays, cycleSettings) === 'luteale', dayMeanBristol) : null),
    [hasCycle, selles, periodDayKeys, cycleDays, cycleSettings],
  )
  const cycleEffort = useMemo(
    () => (hasCycle ? bucketDaysByMetric(selles, periodDayKeys, (d) => phaseForDate(d, cycleDays, cycleSettings) === 'luteale', dayDifficileRate) : null),
    [hasCycle, selles, periodDayKeys, cycleDays, cycleSettings],
  )

  if (!selles.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 2px 16px' }}>
        Aucun passage noté sur cette période. Note tes passages depuis la carte <strong>Transit</strong> de la page du jour pour voir tes stats ici.
      </div>
    )
  }

  return (
    <>
      {/* ── Fréquence & régularité ──────────────────────────────────────── */}
      <div className="section-title">Fréquence & régularité</div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, fontSize: 12.5 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>{regularity.total}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Passages sur la période</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>{regularity.perDay.toFixed(1)}/j</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>En moyenne par jour</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: regularity.pctDaysWithout > 30 ? 'var(--coral)' : 'var(--green)' }}>
              {regularity.pctDaysWithout} %
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Jours sans aucun passage</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {regularity.meanGap != null ? `${regularity.meanGap.toFixed(1)} j` : '—'}
              {regularity.stdGap != null && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)' }}> ± {regularity.stdGap.toFixed(1)}</span>}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Délai moyen entre 2 jours avec passage</div>
          </div>
        </div>
        {regularity.longestGap != null && regularity.longestGap >= 3 && (
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 10 }}>
            Plus longue pause sur la période : {regularity.longestGap} jours.
          </div>
        )}
      </div>

      {/* ── Distribution Bristol ────────────────────────────────────────── */}
      <div className="section-title">Distribution des types (échelle de Bristol)</div>
      <div className="card" style={{ padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {histogram.map((h) => (
            <div key={h.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: h.color, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700,
              }}>
                {h.value}
              </span>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--gray-bg)', overflow: 'hidden' }}>
                <div style={{ width: `${(h.count / maxCount) * 100}%`, height: '100%', background: h.color, opacity: 0.8, borderRadius: 5 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, width: 20, textAlign: 'right', flexShrink: 0 }}>{h.count}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.4 }}>
          Types 1-2 = tendance constipation, 3-4 = idéal, 5-7 = tendance diarrhéique.
        </div>
      </div>

      {/* ── Effort & évacuation ─────────────────────────────────────────── */}
      {effort && (effort.pctDifficile != null || effort.pctIncomplete != null) && (
        <>
          <div className="section-title">Effort & évacuation</div>
          <div className="card" style={{ padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, fontSize: 12.5 }}>
              {effort.pctDifficile != null && (
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>{effort.pctDifficile} %</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Passages difficiles ({effort.nEffort} notés)</div>
                </div>
              )}
              {effort.pctIncomplete != null && (
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>{effort.pctIncomplete} %</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Évacuations incomplètes ({effort.nComplete} notées)</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Remarques fréquentes (hors sang/mucus, déjà en alerte) ───────── */}
      {remarques.length > 0 && (
        <>
          <div className="section-title">Remarques les plus notées</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {remarques.map((r) => (
              <span key={r.key} className="chip" style={{ background: 'var(--amber-light)', color: 'var(--amber)', fontWeight: 600 }}>
                {r.label} · {r.count}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ── Alertes : sang / mucus, jamais noyées dans une moyenne ───────── */}
      {alerts.length > 0 && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 16, borderLeft: '3px solid var(--coral)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: 'var(--coral)' }}>
            <AlertTriangle size={15} /> À surveiller
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {alerts.map((s) => (
              <div key={s.id} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>
                  {new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {formatHeureSelle(s.heure) ? ` · ${formatHeureSelle(s.heure)}` : ''}
                </strong>{' '}
                — {s.remarques.filter((r) => r === 'sang' || r === 'mucus').map(stoolRemarqueLabel).join(', ')}
                {bristolType(s.bristol) ? ` (type ${s.bristol})` : ''}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
            Du sang ou du mucus répété n'est pas anodin — si ça persiste, mieux vaut en parler à un médecin.
          </div>
        </div>
      )}

      {/* ── Corrélations ─────────────────────────────────────────────────── */}
      {showCorrelations && (fibresBristol || waterBristol || sportBristol || cycleBristol) && (
        <div className="section-title">Ce qui semble jouer sur ton transit</div>
      )}
      <CorrelationCard
        color="var(--green)"
        title="Fibres & transit"
        labelA="les jours riches en fibres"
        labelB="les jours plus pauvres"
        stats={fibresBristol}
        effortA={fibresEffort?.meanA}
        effortB={fibresEffort?.meanB}
        disclaimer="Simple observation, pas une relation de cause à effet."
      />
      <CorrelationCard
        color="var(--blue)"
        title="Hydratation & transit"
        labelA="les jours bien hydratés"
        labelB="les jours moins hydratés"
        stats={waterBristol}
        effortA={waterEffort?.meanA}
        effortB={waterEffort?.meanB}
        disclaimer="Simple observation, pas une relation de cause à effet."
      />
      <CorrelationCard
        color="var(--amber)"
        title="Sport & transit"
        labelA="les jours avec séance"
        labelB="les jours sans"
        stats={sportBristol}
        effortA={sportEffort?.meanA}
        effortB={sportEffort?.meanB}
        disclaimer="Simple observation, pas une relation de cause à effet."
      />
      <CorrelationCard
        color="var(--purple)"
        title="Cycle & transit"
        labelA="en phase lutéale"
        labelB="le reste du cycle"
        stats={cycleBristol}
        effortA={cycleEffort?.meanA}
        effortB={cycleEffort?.meanB}
        disclaimer="La progestérone ralentit le transit en lutéale — un petit écart est attendu."
      />
      {showCorrelations && !fibresBristol && !waterBristol && !sportBristol && !cycleBristol && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 2px 16px' }}>
          Pas encore assez de jours notés à la fois côté transit et côté alimentation/sport/cycle sur cette période pour dégager une tendance.
        </div>
      )}
    </>
  )
}
