import React from 'react'
import { useBackButton } from '../hooks/useBackButton'
import { MEALS_ORDER as MEALS } from '../lib/nutrients'

// ─────────────────────────────────────────────────────────────────────────────
// AddToJournalSheet — choix du jour + du repas avant d'ajouter un groupe
// d'aliments (repas type, recette, ...) au journal. Extrait de
// MealTemplatesSection.jsx pour être réutilisable (ex: RecipesSection.jsx).
//
// Props :
//   nom               — nom affiché dans le titre ("Pour quel jour... « {nom} » ?")
//   journalDate / onDateChange (yyyy-mm-dd)
//   journalMeal / onMealChange
//   qty / onQtyChange — OPTIONNEL : ajoute un champ grammage en tête de feuille.
//                       Réservé à l'ajout rapide d'un seul aliment (voir
//                       ExplorerPage.handleQuickAdd) ; les groupes d'aliments à
//                       quantités déjà fixées (repas type, recette) ne le
//                       passent pas et la section reste masquée.
//   onConfirm()
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function AddToJournalSheet({ nom, journalDate, onDateChange, journalMeal, onMealChange, qty, onQtyChange, onConfirm, onClose }) {
  useBackButton(onClose)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Ajouter au journal</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Pour quel jour et quel repas « {nom} » ?
        </div>

        {onQtyChange && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Quantité</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={e => onQtyChange(e.target.value)}
                style={{ width: 110 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>g</span>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Jour</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => onDateChange(yesterdayStr)}
            className="chip"
            style={journalDate === yesterdayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Hier
          </button>
          <button
            onClick={() => onDateChange(todayStr)}
            className="chip"
            style={journalDate === todayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => onDateChange(tomorrowStr)}
            className="chip"
            style={journalDate === tomorrowStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Demain
          </button>
        </div>
        <input
          type="date"
          className="input"
          value={journalDate}
          onChange={e => onDateChange(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Repas</div>
        <select className="input" value={journalMeal} onChange={e => onMealChange(e.target.value)} style={{ marginBottom: 16 }}>
          {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <button className="btn-primary" onClick={onConfirm}>Ajouter</button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
