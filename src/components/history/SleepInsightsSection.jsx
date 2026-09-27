import React, { useState } from 'react'
import {
  CONFIDENCE_LABELS, formatOutcomeValue, formatOutcomeDiff, INSIGHT_WINDOW_DAYS,
} from '../../lib/sleepInsights'
import { formatDureeSommeil } from '../../lib/sleep'
import Loader from '../Loader'

// ─────────────────────────────────────────────────────────────────────────────
// SleepInsightsSection — croisements de l'onglet Sommeil de l'Historique
// (Paliers 3-4, voir docs/suivi-sommeil.md §4.4-4.5). Fenêtre glissante de
// 90 jours, indépendante de la période sélectionnée (une semaine ne suffit
// jamais à voir un lien). Formulation d'observation uniquement.
//
// Props : insights (computeSleepInsights ou null), loading, cycleUsed
// ─────────────────────────────────────────────────────────────────────────────
export default function SleepInsightsSection({ insights, loading, cycleUsed }) {
  const [mode, setMode] = useState('duree') // 'duree' | 'qualite'
  const [showAll, setShowAll] = useState(false)

  if (loading && !insights) return <Loader />
  if (!insights) return null

  const dateFr = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const pick = (o) => (mode === 'duree' ? o.byDuration : o.byQuality)
  const kcal = insights.outcomes.find(o => o.primary)
  const others = insights.outcomes.filter(o => !o.primary)
  const visibleOthers = showAll ? others : others.filter(o => ['net', 'tendance'].includes(pick(o).confidence))
  const lowLabel = mode === 'duree' ? 'une nuit courte' : 'une mauvaise nuit'
  const normalLabel = mode === 'duree' ? 'une nuit normale' : 'une bonne nuit'

  return (
    <>
      <div className="section-title">Ton sommeil et ta journée</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-hint)', margin: '-4px 2px 10px' }}>
        Sur les {INSIGHT_WINDOW_DAYS} jours du {dateFr(insights.startDate)} au {dateFr(insights.endDate)}, quelle que soit la période choisie plus haut.
      </div>

      <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 10, padding: 3, marginBottom: 12 }}>
        {[{ key: 'duree', label: 'Après une nuit courte' }, { key: 'qualite', label: 'Après une mauvaise nuit' }].map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font)',
              background: mode === m.key ? 'var(--white)' : 'transparent',
              color: mode === m.key ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: mode === m.key ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Indicateur principal : calories ── */}
      <MainCard outcome={kcal} effect={pick(kcal)} mode={mode} lowLabel={lowLabel} normalLabel={normalLabel} cycleUsed={cycleUsed} />

      {/* ── Autres indicateurs ── */}
      {pick(kcal).confidence !== 'pas_assez' && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Autres indicateurs</div>
          {visibleOthers.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rien d'autre ne ressort pour l'instant.</div>
          )}
          {visibleOthers.map(o => {
            const e = pick(o)
            return (
              <div key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '0.5px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>{o.label}</div>
                  {e.confidence !== 'pas_assez' && (
                    <div style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>
                      {formatOutcomeValue(o, e.meanLow)} vs {formatOutcomeValue(o, e.meanNormal)}
                    </div>
                  )}
                </div>
                {e.confidence !== 'pas_assez' && (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: e.confidence === 'aucun' ? 'var(--text-muted)' : 'var(--purple)' }}>
                    {formatOutcomeDiff(o, e.diff)}
                  </span>
                )}
                <ConfidenceBadge confidence={e.confidence} />
              </div>
            )
          })}
          <button onClick={() => setShowAll(s => !s)} style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--purple)', background: 'none' }}>
            {showAll ? 'Voir seulement ce qui ressort' : 'Voir tous les indicateurs'}
          </button>
        </div>
      )}

      <FactorsCard factors={insights.factors} />
    </>
  )
}

function MainCard({ outcome, effect, mode, lowLabel, normalLabel, cycleUsed }) {
  if (effect.confidence === 'pas_assez') {
    return (
      <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--purple)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Est-ce que tu manges différemment après {lowLabel} ?</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Pour le savoir, il faut au moins {effect.minDays} jours avec une nuit notée et une journée de repas complète, dont {effect.minLow}{' '}
          {mode === 'duree' ? 'nuits courtes (au moins 45 min sous ton habitude)' : 'nuits notées 😫 ou 😕'} et autant de normales.
        </div>
        <Progress label="Jours utilisables" value={effect.n} max={effect.minDays} />
        <Progress label={mode === 'duree' ? 'Nuits courtes' : 'Mauvaises nuits'} value={effect.nLow} max={effect.minLow} />
        <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 8, lineHeight: 1.4 }}>
          Continue à noter tes nuits et tes repas : c'est en général une question de 2 à 3 mois.
        </div>
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--purple)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>Calories après {lowLabel}</div>
        <ConfidenceBadge confidence={effect.confidence} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Les jours qui suivent {lowLabel}, tu manges en moyenne <strong>{formatOutcomeValue(outcome, effect.meanLow)}</strong>{' '}
        contre <strong>{formatOutcomeValue(outcome, effect.meanNormal)}</strong> après {normalLabel}{' '}
        (<strong style={{ color: effect.confidence === 'aucun' ? 'var(--text-muted)' : 'var(--purple)' }}>{formatOutcomeDiff(outcome, effect.diff)}</strong>).
        {mode === 'duree' && effect.perUnit != null && Math.round(effect.perUnit) !== 0 && (
          <> Chaque heure de sommeil en moins ≈ <strong>{formatOutcomeDiff(outcome, effect.perUnit)}</strong> le lendemain.</>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
        Comparé à jour de semaine comparable{cycleUsed ? ' et à phase du cycle comparable' : ''}, jours exclus et journées incomplètes écartés.
        Simple observation, pas une relation de cause à effet. Sur {effect.nLow} + {effect.nNormal} jours.
      </div>
    </div>
  )
}

function FactorsCard({ factors }) {
  const seen = factors.filter(f => f.seen > 0)
  const rank = (f) => {
    const order = { net: 3, tendance: 2, aucun: 1, pas_assez: 0 }
    return Math.max(order[f.duration.confidence], order[f.quality.confidence])
  }
  const sorted = [...seen].sort((a, b) => rank(b) - rank(a) || b.seen - a.seen)
  const fmtQ = (v) => v.toFixed(1).replace('.', ',')

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--blue)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>Ce qui accompagne tes nuits</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Coche le contexte de ta nuit (café tardif, stress, écrans…) quand tu la notes. Le sport, les dîners copieux,
          l'alcool, les siestes et ton cycle sont repérés automatiquement.
        </div>
      ) : sorted.map(f => {
        const d = f.duration, q = f.quality
        const enough = d.confidence !== 'pas_assez' || q.confidence !== 'pas_assez'
        return (
          <div key={f.key} style={{ padding: '7px 0', borderTop: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span style={{ fontSize: 12.5, flex: 1 }}>{f.label}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>{f.seen} nuit{f.seen > 1 ? 's' : ''}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, marginLeft: 22, lineHeight: 1.5 }}>
              {!enough ? (
                <>Encore {Math.max(1, d.minFactor - d.nWith)} nuit{d.minFactor - d.nWith > 1 ? 's' : ''} pour comparer.</>
              ) : (
                <>
                  {d.confidence !== 'pas_assez' && (
                    <span>
                      Durée : <strong>{d.diff >= 0 ? '+' : '−'}{formatDureeSommeil(Math.abs(d.diff))}</strong>{' '}
                      <ConfidenceBadge confidence={d.confidence} inline />
                    </span>
                  )}
                  {d.confidence !== 'pas_assez' && q.confidence !== 'pas_assez' && ' · '}
                  {q.confidence !== 'pas_assez' && (
                    <span>
                      Qualité : <strong>{fmtQ(q.meanWith)}</strong> vs {fmtQ(q.meanWithout)}{' '}
                      <ConfidenceBadge confidence={q.confidence} inline />
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      {sorted.length > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 6, lineHeight: 1.4 }}>
          Nuits avec ce facteur (la veille ou pendant la nuit) comparées aux autres, semaine et week-end séparés. Simple observation.
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ confidence, inline = false }) {
  if (confidence === 'pas_assez') {
    return inline ? null : <span style={{ fontSize: 10, color: 'var(--text-hint)', flexShrink: 0 }}>pas assez de jours</span>
  }
  const style = {
    net: { background: 'var(--purple)', color: 'white' },
    tendance: { background: 'var(--purple-light)', color: 'var(--purple)' },
    aucun: { background: 'var(--gray-bg)', color: 'var(--text-muted)' },
  }[confidence]
  return (
    <span style={{ ...style, fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-block' }}>
      {confidence === 'aucun' ? 'pas de différence' : CONFIDENCE_LABELS[confidence].toLowerCase()}
    </span>
  )
}

function Progress({ label, value, max }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>{label}</span><span><strong>{Math.min(value, max)}</strong>/{max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-bg)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--purple)', borderRadius: 3 }} />
      </div>
    </div>
  )
}
