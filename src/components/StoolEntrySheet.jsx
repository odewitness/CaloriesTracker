import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Droplets, Trash2 } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { dateLabel } from '../lib/dates'
import { BRISTOL_TYPES, STOOL_COULEURS, STOOL_EFFORTS, STOOL_REMARQUES, nowHeure } from '../lib/stool'
import BrandCombobox from './BrandCombobox'

const DEFAULT_LIEUX = ['Maison', 'Extérieur']

// ─────────────────────────────────────────────────────────────────────────────
// StoolEntrySheet — feuille « Ajouter / modifier un passage » (page du jour).
// Rendu via portal sur document.body : montée dans le slider de jours de
// TodayPage, un `position: fixed` se calerait sinon sur le conteneur transformé
// (voir CLAUDE.md — pattern d'AddWaterSheet / SportEntrySheet).
//
// Props :
//   date      — Date ou 'YYYY-MM-DD' du jour concerné (affichage seulement)
//   initial   — passage existant à modifier, ou null pour un ajout
//   onSave(payload)  — insert (ajout) ou patch (édition, mêmes champs)
//   onDelete(id)     — seulement en édition
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function StoolEntrySheet({ date, initial = null, lieux = [], onSave, onDelete, onClose }) {
  useBackButton(onClose)
  const editing = !!initial

  const [bristol, setBristol] = useState(initial?.bristol || null)
  const [couleur, setCouleur] = useState(initial?.couleur || null)
  const [effort, setEffort] = useState(initial?.effort || null)
  const [evacuationComplete, setEvacuationComplete] = useState(
    initial?.evacuation_complete === true ? true : initial?.evacuation_complete === false ? false : null,
  )
  const [heure, setHeure] = useState(initial?.heure ? String(initial.heure).slice(0, 5) : (editing ? '' : nowHeure()))
  const [lieu, setLieu] = useState(initial?.lieu || '')
  const [remarques, setRemarques] = useState(initial?.remarques || [])
  const [note, setNote] = useState(initial?.note || '')

  const toggleRemarque = (key) => {
    setRemarques(r => r.includes(key) ? r.filter(k => k !== key) : [...r, key])
  }

  const valid = !!bristol

  const submit = () => {
    if (!valid) return
    const payload = {
      bristol,
      couleur: couleur || null,
      effort: effort || null,
      evacuation_complete: evacuationComplete,
      heure: heure || null,
      lieu: lieu.trim() || null,
      remarques,
      note: note.trim() || null,
    }
    onSave(payload)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Droplets size={17} color="var(--amber)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{editing ? 'Modifier le passage' : 'Ajouter un passage'}</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {dateLabel(date)}
        </div>

        {/* ── Échelle de Bristol ── */}
        <SheetLabel>Échelle de Bristol</SheetLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {BRISTOL_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setBristol(t.value)}
              style={{
                flex: 1, height: 36, borderRadius: 9, fontWeight: 700, fontSize: 14,
                background: bristol === t.value ? t.color : 'var(--gray-bg)',
                color: bristol === t.value ? 'white' : 'var(--text-muted)',
                fontFamily: 'var(--font)',
              }}
            >
              {t.value}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 16, minHeight: 32 }}>
          {bristol ? BRISTOL_TYPES.find(t => t.value === bristol)?.desc : 'Choisis le type qui correspond le mieux.'}
        </div>

        {/* ── Couleur ── */}
        <SheetLabel>Couleur <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {STOOL_COULEURS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCouleur(couleur === c.key ? null : c.key)}
              aria-label={c.label}
              title={c.label}
              style={{
                width: 30, height: 30, borderRadius: '50%', background: c.hex,
                border: couleur === c.key ? '3px solid var(--text)' : '1px solid var(--border-md)',
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>

        {/* ── Effort ── */}
        <SheetLabel>Effort à l'évacuation <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {STOOL_EFFORTS.map((e) => (
            <button
              key={e.key}
              onClick={() => setEffort(effort === e.key ? null : e.key)}
              className="chip"
              style={{
                flex: 1, textAlign: 'center',
                background: effort === e.key ? 'var(--amber)' : 'var(--gray-bg)',
                color: effort === e.key ? 'white' : 'var(--text-muted)',
              }}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* ── Évacuation complète ── */}
        <SheetLabel>Évacuation complète <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ key: true, label: 'Oui' }, { key: false, label: 'Non' }].map((o) => (
            <button
              key={String(o.key)}
              onClick={() => setEvacuationComplete(evacuationComplete === o.key ? null : o.key)}
              className="chip"
              style={{
                flex: 1, textAlign: 'center',
                background: evacuationComplete === o.key ? 'var(--amber)' : 'var(--gray-bg)',
                color: evacuationComplete === o.key ? 'white' : 'var(--text-muted)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* ── Heure & lieu ── */}
        <SheetLabel>Heure <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <input
          className="input"
          type="time"
          value={heure}
          onChange={(e) => setHeure(e.target.value)}
          style={{ width: 130, marginBottom: 16 }}
        />

        <SheetLabel>Lieu <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ marginBottom: 16 }}>
          <BrandCombobox value={lieu} onChange={setLieu} options={lieux.length ? lieux : DEFAULT_LIEUX} />
        </div>

        {/* ── Remarques ── */}
        <SheetLabel>Remarques <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {STOOL_REMARQUES.map((r) => (
            <button
              key={r.key}
              onClick={() => toggleRemarque(r.key)}
              className="chip"
              style={remarques.includes(r.key)
                ? { background: 'var(--amber)', color: 'white' }
                : { background: 'var(--gray-bg)', color: 'var(--text-muted)' }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* ── Note ── */}
        <SheetLabel>Note <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--text-hint)' }}>· facultatif</span></SheetLabel>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Contexte, sensations…"
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 8, padding: 8, fontSize: 13, fontFamily: 'var(--font)', resize: 'vertical', background: 'var(--gray-bg)', outline: 'none', marginBottom: 16 }}
        />

        <button className="btn-primary" onClick={submit} disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }}>
          {editing ? 'Enregistrer' : 'Ajouter le passage'}
        </button>

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
