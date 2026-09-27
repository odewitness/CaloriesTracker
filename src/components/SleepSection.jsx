import React, { useState } from 'react'
import { Moon, ChevronDown, Plus, Pencil } from 'lucide-react'
import {
  sleepQualite, formatHeureSommeil, formatDureeSommeil, formatEcart, nightLabel,
  lastNights, sleepDebt,
} from '../lib/sleep'
import { QualitePicker } from './SleepEntrySheet'

const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] // index = getDay()

// ─────────────────────────────────────────────────────────────────────────────
// SleepSection — carte « Sommeil » de la page du jour (clé `sommeil` de
// todaySections.js). Affiche la nuit qui s'est terminée le matin du jour
// affiché (convention « date du réveil », voir src/lib/sleep.js).
//
// Nuit pas notée : « Comme d'habitude » enregistre en un appui avec les
// horaires habituels, « Détailler » ouvre la feuille. Nuit notée : durée,
// qualité, heures, écart à l'objectif, 7 dernières nuits, manque de sommeil.
// Nuit notée sans qualité (typiquement après « Comme d'habitude ») : les 5
// visages restent proposés en ligne, un appui suffit.
//
// Props :
//   dateStr, night, nights (60 j), usual (usualTimes ou null), objectifMin
//   isFuture          — jour à venir : rien à noter
//   onQuickLog()      — enregistre « comme d'habitude »
//   onSetQualite(v)   — met à jour la qualité de la nuit
//   onOpenSheet()     — ouvre la feuille (ajout ou édition)
// ─────────────────────────────────────────────────────────────────────────────
export default function SleepSection({ dateStr, night, nights = [], usual, objectifMin = 480, isFuture, onQuickLog, onSetQualite, onOpenSheet }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sleep-collapsed')) ?? false }
    catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c
    try { localStorage.setItem('sleep-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
    return next
  })

  const q = night ? sleepQualite(night.qualite) : null
  let subtitle = nightLabel(dateStr)
  if (night && collapsed) subtitle += ` · ${formatDureeSommeil(night.duree_min)}${q ? ` ${q.emoji}` : ''}`

  const bed = night ? formatHeureSommeil(night.heure_endormissement) : null
  const wake = night ? formatHeureSommeil(night.heure_reveil) : null
  const ecart = night ? night.duree_min - objectifMin : 0
  const debt = night ? sleepDebt(nights, dateStr, objectifMin) : null

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px' }}>
        <button
          onClick={toggleCollapsed}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, textAlign: 'left', minWidth: 0 }}
        >
          <ChevronDown
            size={16}
            color="var(--text-hint)"
            style={{ flexShrink: 0, transition: 'transform .2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Moon size={14} color="var(--purple)" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Sommeil</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>
          </div>
        </button>
        {!isFuture && (
          <button
            onClick={onOpenSheet}
            style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--purple-light)', color: 'var(--purple)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6,
            }}
            aria-label={night ? 'Modifier ma nuit' : 'Noter ma nuit'}
          >
            {night ? <Pencil size={14} /> : <Plus size={17} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '0 14px 14px' }}>
          {isFuture ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-hint)' }}>Tu pourras noter cette nuit à ton réveil.</div>
          ) : !night ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Comment as-tu dormi ?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {usual && (
                  <button
                    onClick={onQuickLog}
                    style={{
                      flex: 1, padding: '9px 10px', borderRadius: 10, background: 'var(--purple-light)', color: 'var(--purple)',
                      fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', textAlign: 'center', lineHeight: 1.3,
                    }}
                  >
                    Comme d'habitude
                    <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                      {usual.heure_endormissement} → {usual.heure_reveil}
                    </div>
                  </button>
                )}
                <button
                  onClick={onOpenSheet}
                  style={{
                    flex: usual ? '0 0 auto' : 1, padding: '9px 14px', borderRadius: 10,
                    background: usual ? 'var(--gray-bg)' : 'var(--purple-light)',
                    color: usual ? 'var(--text)' : 'var(--purple)',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
                  }}
                >
                  {usual ? 'Détailler' : 'Noter ma nuit'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onOpenSheet} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--purple)' }}>{formatDureeSommeil(night.duree_min)}</span>
                  {q && <span style={{ fontSize: 18 }} title={q.label}>{q.emoji}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {bed && wake ? `${bed} → ${wake} · ` : ''}objectif {formatDureeSommeil(objectifMin)}
                  {ecart !== 0 && <> ({formatEcart(ecart)})</>}
                </div>
              </button>

              {q == null && onSetQualite && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Et la qualité ressentie ?</div>
                  <QualitePicker value={null} onChange={(v) => v != null && onSetQualite(v)} compact />
                </div>
              )}

              <LastNightsBars nights={nights} dateStr={dateStr} objectifMin={objectifMin} />

              {debt && debt.minutes >= 60 && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                  Manque de sommeil sur les 7 dernières nuits : <strong>{formatDureeSommeil(debt.minutes)}</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Mini-histogramme des 7 dernières nuits (la nuit du jour en plein, les
// autres en transparence), ligne pointillée = objectif.
function LastNightsBars({ nights, dateStr, objectifMin }) {
  const days = lastNights(nights, dateStr, 7)
  if (days.filter(d => d.night).length < 2) return null
  const max = Math.max(objectifMin * 1.25, ...days.map(d => d.night?.duree_min || 0))
  const H = 44
  const goalY = (objectifMin / max) * H
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, height: H }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: goalY, borderTop: '1px dashed var(--border-md)' }} />
        {days.map(({ date, night }) => (
          <div key={date} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {night ? (
              <div
                title={formatDureeSommeil(night.duree_min)}
                style={{
                  width: '100%', maxWidth: 22, borderRadius: 3,
                  height: Math.max(3, (night.duree_min / max) * H),
                  background: 'var(--purple)', opacity: date === dateStr ? 1 : 0.4,
                }}
              />
            ) : (
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-md)' }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
        {days.map(({ date }) => (
          <div key={date} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: date === dateStr ? 'var(--text)' : 'var(--text-hint)', fontWeight: date === dateStr ? 700 : 500 }}>
            {WEEKDAY_INITIALS[new Date(date + 'T12:00:00').getDay()]}
          </div>
        ))}
      </div>
    </div>
  )
}
