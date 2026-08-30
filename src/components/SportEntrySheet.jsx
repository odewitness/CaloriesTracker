import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dumbbell, Trash2, Share2 } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { dateLabel } from '../lib/dates'
import {
  SPORT_TYPES, SPORT_INTENSITES, sportType, estimateKcal, formatDuree,
} from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// SportEntrySheet — feuille « Ajouter / modifier une séance » (page du jour).
// Rendu via portal sur document.body : montée dans le slider de jours de
// TodayPage, un `position: fixed` se calerait sinon sur le conteneur transformé
// (voir CLAUDE.md — pattern d'AddWaterSheet).
//
// Props :
//   date      — Date ou 'YYYY-MM-DD' du jour concerné (affichage seulement)
//   poidsKg   — pour l'estimation des calories (optionnel)
//   initial   — séance existante à modifier, ou null pour un ajout
//   onSave(payload)  — insert (ajout) ou patch (édition, mêmes champs)
//   onDelete(id)     — seulement en édition
//   onShare(activite) — seulement en édition : partager cette séance sur le fil
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function SportEntrySheet({ date, poidsKg, initial = null, onSave, onDelete, onShare, onClose }) {
  useBackButton(onClose)
  const editing = !!initial

  const [type, setType] = useState(initial?.type || 'course')
  const [dureeText, setDureeText] = useState(initial?.duree_min != null ? String(initial.duree_min) : '')
  const [distText, setDistText] = useState(initial?.distance_km != null ? String(initial.distance_km) : '')
  const [intensite, setIntensite] = useState(initial?.intensite || null)
  const [heure, setHeure] = useState(initial?.heure_debut ? String(initial.heure_debut).slice(0, 5) : '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [kcalText, setKcalText] = useState(initial?.energie_kcal != null ? String(initial.energie_kcal) : '')
  const [kcalTouched, setKcalTouched] = useState(initial?.energie_kcal != null)

  const t = sportType(type)
  const dureeMin = parseInt(dureeText, 10)
  const estimate = useMemo(
    () => estimateKcal({ type, poidsKg, dureeMin, intensite }),
    [type, poidsKg, dureeMin, intensite],
  )

  // Tant que l'utilisatrice n'a pas saisi de calories à la main, le champ suit
  // l'estimation MET.
  useEffect(() => {
    if (!kcalTouched) setKcalText(estimate != null ? String(estimate) : '')
  }, [estimate, kcalTouched])

  const valid = t && dureeMin > 0

  const submit = () => {
    if (!valid) return
    const kcal = kcalText !== '' && !isNaN(parseInt(kcalText, 10)) ? parseInt(kcalText, 10) : null
    const dist = t.distance && distText !== '' && !isNaN(parseFloat(distText)) ? parseFloat(distText) : null
    const payload = {
      type,
      duree_min: dureeMin,
      distance_km: dist,
      intensite: intensite || null,
      heure_debut: heure || null,
      energie_kcal: kcal,
      notes: notes.trim() || null,
      source: initial?.source || 'manuel',
    }
    if (editing && initial.source && initial.source !== 'manuel') payload.modifie_manuellement = true
    onSave(payload)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Dumbbell size={17} color="var(--green)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{editing ? 'Modifier la séance' : 'Ajouter une séance'}</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {dateLabel(date)}
        </div>

        {/* ── Type ── */}
        <SheetLabel>Type d'activité</SheetLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {SPORT_TYPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setType(s.key)}
              className="chip"
              style={s.key === type
                ? { background: 'var(--green)', color: 'white' }
                : { background: 'var(--green-light)', color: 'var(--green-dark)' }}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {/* ── Durée ── */}
        <SheetLabel>Durée</SheetLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="45"
            value={dureeText}
            onChange={(e) => setDureeText(e.target.value)}
            style={{ width: 90 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>min</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {[15, 30, 45, 60, 90].map((m) => (
            <button
              key={m}
              onClick={() => setDureeText(String(m))}
              className="chip"
              style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', fontSize: 11.5 }}
            >
              {formatDuree(m)}
            </button>
          ))}
        </div>

        {/* ── Distance (types concernés) ── */}
        {t?.distance && (
          <>
            <SheetLabel>Distance <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="5"
                value={distText}
                onChange={(e) => setDistText(e.target.value)}
                style={{ width: 90 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>km</span>
            </div>
          </>
        )}

        {/* ── Intensité ── */}
        <SheetLabel>Intensité ressentie <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {SPORT_INTENSITES.map((i) => (
            <button
              key={i.key}
              onClick={() => setIntensite(intensite === i.key ? null : i.key)}
              className="chip"
              style={{
                flex: 1, textAlign: 'center',
                background: intensite === i.key ? 'var(--green)' : 'var(--gray-bg)',
                color: intensite === i.key ? 'white' : 'var(--text-muted)',
              }}
            >
              {i.label}
            </button>
          ))}
        </div>

        {/* ── Heure ── */}
        <SheetLabel>Heure de début <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <input
          className="input"
          type="time"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          style={{ width: 130, marginBottom: 16 }}
        />

        {/* ── Calories ── */}
        <SheetLabel>Calories dépensées</SheetLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: 'var(--text-hint)' }}>≈</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="—"
            value={kcalText}
            onChange={(e) => { setKcalText(e.target.value); setKcalTouched(true) }}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>kcal</span>
          {kcalTouched && estimate != null && (
            <button
              onClick={() => { setKcalTouched(false); setKcalText(String(estimate)) }}
              style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font)' }}
            >
              Réestimer ({estimate})
            </button>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16 }}>
          Estimation à partir du type, de la durée et de ton poids — approximative
          (±20 %). Tu peux la corriger. Sans effet sur tes objectifs de calories.
        </div>

        {/* ── Notes ── */}
        <SheetLabel>Notes <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Sensations, parcours, exercices…"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'var(--font)', resize: 'vertical', background: 'var(--gray-bg)', outline: 'none', marginBottom: 16 }}
        />

        <button className="btn-primary" onClick={submit} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
          {editing ? 'Enregistrer' : 'Ajouter la séance'}
        </button>

        {editing && onShare && (
          <button
            onClick={() => onShare(initial)}
            className="btn-ghost"
            style={{ width: '100%', textAlign: 'center', marginTop: 8, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
          >
            <Share2 size={15} /> Partager avec mes amies
          </button>
        )}
        {editing && (
          <button
            onClick={() => onDelete(initial.id)}
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

function SheetLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
      {children}
    </div>
  )
}
