import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Footprints, Trash2 } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { dateLabel } from '../lib/dates'
import { stepKcal } from '../lib/sport'

// ─────────────────────────────────────────────────────────────────────────────
// StepsSheet — feuille « Mes pas du jour » (Palier 10). Un seul chiffre par
// jour (table `pas_jour`). Rendu via portal sur document.body : montée dans le
// slider de jours de TodayPage (voir CLAUDE.md — pattern d'AddWaterSheet).
//
// Props :
//   date     — Date ou 'YYYY-MM-DD' du jour concerné (affichage)
//   initial  — total de pas déjà enregistré, ou null
//   poidsKg  — pour l'estimation d'énergie affichée (optionnel)
//   seuil    — pas_seuil_baseline (pas déjà « inclus » dans le TDEE)
//   objectif — objectif_pas_jour (0 = aucun)
//   onSave(nbPas) — upsert (0 / vide = efface la ligne)
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
const QUICK = [2000, 5000, 8000, 10000, 12000]

export default function StepsSheet({ date, initial = null, poidsKg, seuil = 4000, objectif = 0, onSave, onClose }) {
  useBackButton(onClose)
  const [text, setText] = useState(initial != null ? String(initial) : '')

  const n = parseInt(text, 10)
  const nb = !isNaN(n) && n > 0 ? n : 0
  const kcal = stepKcal({ nbPas: nb, poidsKg, seuil })
  const pctObj = objectif > 0 && nb > 0 ? Math.round((nb / objectif) * 100) : null

  const submit = () => { onSave(nb); onClose() }
  const clear = () => { onSave(0); onClose() }

  return createPortal(
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Footprints size={17} color="var(--green)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Mes pas du jour</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {dateLabel(date)} — recopie le total affiché par ton téléphone ou ta montre.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="8000"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: 130, fontSize: 18, fontWeight: 700 }}
            autoFocus
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>pas</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {QUICK.map((v) => (
            <button
              key={v}
              onClick={() => setText(String(v))}
              className="chip"
              style={{ background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 12 }}
            >
              {v.toLocaleString('fr-FR')}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-hint)', lineHeight: 1.55, marginBottom: 16 }}>
          {pctObj != null && <>{pctObj} % de ton objectif ({objectif.toLocaleString('fr-FR')} pas). </>}
          {kcal != null
            ? <>Énergie estimée ≈ <strong>{kcal} kcal</strong> (au-dessus des {seuil.toLocaleString('fr-FR')} pas déjà comptés dans ta dépense de base). Sert seulement au bilan / à « manger selon l'effort » si tu les as activés.</>
            : <>Renseigne ton poids (Poids & mensurations) pour voir l'énergie estimée.</>}
        </div>

        <button className="btn-primary" onClick={submit} disabled={text === ''} style={{ opacity: text === '' ? 0.5 : 1 }}>
          Enregistrer
        </button>
        {initial != null && (
          <button
            onClick={clear}
            className="btn-ghost"
            style={{ width: '100%', textAlign: 'center', marginTop: 8, color: 'var(--coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Trash2 size={15} /> Effacer
          </button>
        )}
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 4 }} onClick={onClose}>Fermer</button>
      </div>
    </div>,
    document.body,
  )
}
