import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Moon, Trash2, Minus, Plus } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import {
  SLEEP_QUALITES, DEFAULT_BEDTIME, DEFAULT_WAKE,
  sleepWindow, shiftTime, formatHeureSommeil, formatDureeSommeil, nightLabel,
} from '../lib/sleep'
import { SLEEP_FACTORS } from '../lib/sleepInsights'

// ─────────────────────────────────────────────────────────────────────────────
// SleepEntrySheet — feuille « Ma nuit » (page du jour). Rendu via portal sur
// document.body : montée dans le slider de jours de TodayPage, un
// `position: fixed` se calerait sinon sur le conteneur transformé (voir
// CLAUDE.md — pattern de StoolEntrySheet / SportEntrySheet).
//
// La durée se calcule toute seule à partir des deux heures ; la modifier à la
// main (ex. durée affichée par la montre) la « détache » des heures et
// l'écart devient du temps éveillé dans la nuit. Sans les heures, on peut ne
// saisir que la durée.
//
// Props :
//   dateStr   — date du RÉVEIL ('YYYY-MM-DD')
//   initial   — nuit existante à modifier, ou null
//   usual     — horaires habituels (usualTimes) pour pré-remplir, ou null
//   prefill   — { heure_endormissement, heure_reveil } venant de « Je vais
//               dormir » / « Je suis réveillée » (prioritaire sur `usual`)
//   onSave(payload) / onDelete() / onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function SleepEntrySheet({ dateStr, initial = null, usual = null, prefill = null, onSave, onDelete, onClose }) {
  useBackButton(onClose)
  const editing = !!initial

  const initialHasTimes = editing ? !!(initial.heure_endormissement && initial.heure_reveil) : true
  const [withTimes, setWithTimes] = useState(initialHasTimes)
  const [bed, setBed] = useState(
    formatHeureSommeil(initial?.heure_endormissement) || prefill?.heure_endormissement || usual?.heure_endormissement || DEFAULT_BEDTIME,
  )
  const [wake, setWake] = useState(
    formatHeureSommeil(initial?.heure_reveil) || prefill?.heure_reveil || usual?.heure_reveil || DEFAULT_WAKE,
  )

  const win = withTimes ? sleepWindow(dateStr, bed, wake) : null
  // Durée « détachée » des heures : nuit existante dont la durée diffère de la
  // fenêtre, durée habituelle avec temps éveillé, ou saisie sans heures.
  const [duree, setDuree] = useState(() => {
    if (editing) return initial.duree_min
    if (prefill) return sleepWindow(dateStr, bed, wake)?.minutes ?? 480
    return usual?.duree_min ?? sleepWindow(dateStr, bed, wake)?.minutes ?? 480
  })
  const [dureeTouched, setDureeTouched] = useState(() => {
    if (editing) {
      const w = sleepWindow(dateStr, initial.heure_endormissement, initial.heure_reveil)
      return !w || w.minutes !== initial.duree_min
    }
    if (prefill) return false
    const w = sleepWindow(dateStr, bed, wake)
    return !!w && usual?.duree_min != null && usual.duree_min !== w.minutes
  })
  const effectiveDuree = withTimes && !dureeTouched && win ? win.minutes : duree
  const awakeMin = withTimes && win ? win.minutes - effectiveDuree : 0

  const [qualite, setQualite] = useState(initial?.qualite ?? null)
  const [reveilNaturel, setReveilNaturel] = useState(
    editing ? (initial.reveil_naturel ?? null) : (usual?.reveil_naturel ?? null),
  )
  const [note, setNote] = useState(initial?.note || '')
  const [facteurs, setFacteurs] = useState(initial?.facteurs || [])
  const [sieste, setSieste] = useState(Number(initial?.sieste_min) || 0)
  const toggleFacteur = (key) => setFacteurs(f => (f.includes(key) ? f.filter(k => k !== key) : [...f, key]))

  const setDureeManual = (m) => {
    setDureeTouched(true)
    setDuree(Math.max(0, Math.min(1440, m)))
  }
  const resetDuree = () => setDureeTouched(false)

  const tooLong = awakeMin < 0
  const unusual = effectiveDuree > 14 * 60 || (effectiveDuree > 0 && effectiveDuree < 60)
  const valid = effectiveDuree != null && !tooLong

  const submit = () => {
    if (!valid) return
    onSave({
      heure_endormissement: withTimes ? bed : null,
      heure_reveil: withTimes ? wake : null,
      duree_min: Math.round(effectiveDuree),
      qualite,
      reveil_naturel: reveilNaturel,
      facteurs,
      sieste_min: sieste > 0 ? sieste : null,
      note: note.trim() || null,
    })
  }

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Moon size={17} color="var(--purple)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{editing ? 'Modifier ma nuit' : 'Ma nuit'}</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {nightLabel(dateStr)}
        </div>

        {withTimes ? (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <TimeField label="Endormissement" value={bed} onChange={setBed} />
              <TimeField label="Réveil" value={wake} onChange={setWake} />
            </div>
            <button
              onClick={() => { setWithTimes(false); setDuree(effectiveDuree ?? 480); setDureeTouched(true) }}
              style={{ fontSize: 12, color: 'var(--text-hint)', fontWeight: 600, marginBottom: 16, background: 'none' }}
            >
              Je ne connais que la durée
            </button>
          </>
        ) : (
          <button
            onClick={() => { setWithTimes(true); setDureeTouched(false) }}
            style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600, marginBottom: 12, background: 'none' }}
          >
            + Ajouter les heures d'endormissement et de réveil
          </button>
        )}

        {/* ── Durée ── */}
        <SheetLabel>Durée de sommeil</SheetLabel>
        <DurationField value={effectiveDuree} onChange={setDureeManual} />
        <div style={{ fontSize: 11.5, color: tooLong ? 'var(--coral)' : 'var(--text-hint)', lineHeight: 1.5, margin: '6px 0 16px', minHeight: 16 }}>
          {tooLong
            ? 'La durée dépasse le temps entre ton endormissement et ton réveil.'
            : withTimes && dureeTouched && awakeMin > 0
              ? <>Dont {formatDureeSommeil(awakeMin)} éveillée dans la nuit · <button onClick={resetDuree} style={{ color: 'var(--purple)', fontWeight: 600, fontSize: 11.5, background: 'none' }}>recalculer</button></>
              : withTimes
                ? 'Calculée d\'après tes heures. Modifie-la si tu t\'es réveillée dans la nuit.'
                : null}
          {unusual && !tooLong && <div style={{ color: 'var(--amber)' }}>Durée inhabituelle, vérifie les heures.</div>}
        </div>

        {/* ── Qualité ── */}
        <SheetLabel>Qualité ressentie</SheetLabel>
        <QualitePicker value={qualite} onChange={setQualite} />

        {/* ── Réveil naturel ── */}
        <SheetLabel>Réveil</SheetLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ key: true, label: 'Sans alarme' }, { key: false, label: 'Avec alarme' }].map((o) => (
            <button
              key={String(o.key)}
              onClick={() => setReveilNaturel(reveilNaturel === o.key ? null : o.key)}
              className="chip"
              style={{
                flex: 1, textAlign: 'center',
                background: reveilNaturel === o.key ? 'var(--purple)' : 'var(--gray-bg)',
                color: reveilNaturel === o.key ? 'white' : 'var(--text-muted)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Contexte (croisé avec la durée et la qualité, Historique > Sommeil) ── */}
        <SheetLabel>Contexte de la nuit <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {SLEEP_FACTORS.map((f) => {
            const on = facteurs.includes(f.key)
            return (
              <button
                key={f.key}
                onClick={() => toggleFacteur(f.key)}
                className="chip"
                style={{
                  background: on ? 'var(--purple)' : 'var(--gray-bg)',
                  color: on ? 'white' : 'var(--text-muted)',
                }}
              >
                {f.emoji} {f.label}
              </button>
            )
          })}
        </div>

        {/* ── Sieste de la journée (jour du réveil) ── */}
        <SheetLabel>Sieste dans la journée <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setSieste(v => Math.max(0, v - 10))} style={roundBtn} aria-label="Moins 10 minutes"><Minus size={14} /></button>
          <div style={{ minWidth: 70, textAlign: 'center', fontSize: 15, fontWeight: 700, color: sieste ? 'var(--purple)' : 'var(--text-hint)' }}>
            {sieste ? formatDureeSommeil(sieste) : 'Aucune'}
          </div>
          <button onClick={() => setSieste(v => Math.min(600, v + 10))} style={roundBtn} aria-label="Plus 10 minutes"><Plus size={14} /></button>
        </div>

        <SheetLabel>Note <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Réveils, rêves, contexte…"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'var(--font)', resize: 'vertical', background: 'var(--gray-bg)', outline: 'none', marginBottom: 16 }}
        />

        <button className="btn-primary" onClick={submit} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
          {editing ? 'Enregistrer' : 'Noter ma nuit'}
        </button>

        {editing && (
          <button
            onClick={onDelete}
            className="btn-ghost"
            style={{ width: '100%', textAlign: 'center', marginTop: 8, color: 'var(--coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Trash2 size={15} /> Supprimer
          </button>
        )}

        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 4 }} onClick={onClose}>Fermer</button>
      </div>
    </div>,
    document.body,
  )
}

const roundBtn = { width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

// Sélecteur de qualité (5 visages), réutilisé en ligne par la carte du jour.
export function QualitePicker({ value, onChange, compact = false }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: compact ? 0 : 16 }}>
      {SLEEP_QUALITES.map((q) => {
        const on = value === q.value
        return (
          <button
            key={q.value}
            onClick={() => onChange(on ? null : q.value)}
            aria-label={q.label}
            title={q.label}
            style={{
              flex: 1, height: compact ? 34 : 40, borderRadius: 10, fontSize: compact ? 18 : 21,
              background: on ? 'var(--purple-light)' : 'var(--gray-bg)',
              border: on ? '2px solid var(--purple)' : '2px solid transparent',
              opacity: value != null && !on ? 0.5 : 1,
            }}
          >
            {q.emoji}
          </button>
        )
      })}
    </div>
  )
}

function TimeField({ label, value, onChange }) {
  const btn = { width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <SheetLabel>{label}</SheetLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => onChange(shiftTime(value, -15))} style={btn} aria-label="15 minutes plus tôt"><Minus size={14} /></button>
        <input
          className="input"
          type="time"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '8px 2px' }}
        />
        <button onClick={() => onChange(shiftTime(value, 15))} style={btn} aria-label="15 minutes plus tard"><Plus size={14} /></button>
      </div>
    </div>
  )
}

// Durée en heures + minutes (deux petits champs) avec pas de ±15 min.
function DurationField({ value, onChange }) {
  const v = Math.max(0, Math.round(value || 0))
  const h = Math.floor(v / 60)
  const m = v % 60
  const btn = { width: 30, height: 30, borderRadius: '50%', background: 'var(--gray-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  const box = { width: 52, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 4px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--purple)', background: 'var(--gray-bg)', outline: 'none' }
  const num = (s) => { const n = parseInt(s, 10); return isNaN(n) ? 0 : n }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(v - 15)} style={btn} aria-label="Moins 15 minutes"><Minus size={14} /></button>
      <input type="number" inputMode="numeric" value={h} min={0} max={24} onChange={(e) => onChange(Math.min(24, num(e.target.value)) * 60 + m)} style={box} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>h</span>
      <input type="number" inputMode="numeric" value={m} min={0} max={59} onChange={(e) => onChange(h * 60 + Math.min(59, num(e.target.value)))} style={box} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>min</span>
      <button onClick={() => onChange(v + 15)} style={btn} aria-label="Plus 15 minutes"><Plus size={14} /></button>
    </div>
  )
}

function SheetLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
      {children}
    </div>
  )
}
