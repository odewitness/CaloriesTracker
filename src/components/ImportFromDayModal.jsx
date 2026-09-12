import React, { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { useToast } from '../lib/toast'
import { MEALS_ORDER as MEALS } from '../lib/nutrients'
import { useJournal } from '../hooks/useJournal'
import { useBackButton } from '../hooks/useBackButton'
import { todayStr } from '../lib/dates'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// Choix d'un jour + repas dans le journal, sélection d'aliments à la carte,
// renvoyés "nettoyés" (id/date/meal/user_id/created_at retirés) via onImport.
// Extrait de EditMealTemplatePage.jsx pour être réutilisable : import dans un
// repas type en cours d'édition, ou copie directe dans le journal d'un autre
// jour (voir TodayPage, bouton "Copier depuis un autre jour" de MealSection).
// ─────────────────────────────────────────────────────────────────────────────
export default function ImportFromDayModal({ title = 'Importer un repas', defaultDate, onImport, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const today = todayStr()
  const yesterdayStr = todayStr(-1)

  const [date, setDate] = useState(defaultDate || yesterdayStr)
  const [selectedMeal, setSelectedMeal] = useState(MEALS[0])
  const { entries, loading } = useJournal(date)
  const [checked, setChecked] = useState({})

  const mealEntries = entries.filter(e => e.meal === selectedMeal)

  useEffect(() => {
    const next = {}
    for (const e of mealEntries) next[e.id] = true
    setChecked(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedMeal, entries])

  const toggle = (id) => setChecked(c => ({ ...c, [id]: !c[id] }))
  const toggleAll = () => {
    const allChecked = mealEntries.every(e => checked[e.id])
    const next = {}
    for (const e of mealEntries) next[e.id] = !allChecked
    setChecked(next)
  }

  const selectedEntries = mealEntries.filter(e => checked[e.id])

  const handleImport = () => {
    if (selectedEntries.length === 0) { toast('Coche au moins un aliment'); return }
    const items = selectedEntries.map(({ id, date: _d, meal: _m, user_id, created_at, ...rest }) => rest)
    onImport(items)
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>{title}</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body">
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le jour
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setDate(yesterdayStr)}
            className="chip"
            style={date === yesterdayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Hier
          </button>
          <button
            onClick={() => setDate(today)}
            className="chip"
            style={date === today ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Aujourd'hui
          </button>
          <input
            type="date"
            className="input"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le repas
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {MEALS.map(m => {
            const active = selectedMeal === m
            return (
              <button
                key={m}
                onClick={() => setSelectedMeal(m)}
                style={{
                  flex: '1 1 auto',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--green)' : 'var(--gray-bg)',
                  color: active ? 'white' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'var(--font)',
                  transition: 'all .15s',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>

        {loading && <Loader />}

        {!loading && mealEntries.length === 0 && (
          <EmptyState style={{ padding: '20px 10px' }}>
            Aucun aliment enregistré pour « {selectedMeal} » à cette date
          </EmptyState>
        )}

        {!loading && mealEntries.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                {mealEntries.length} aliment{mealEntries.length > 1 ? 's' : ''}
              </div>
              <button onClick={toggleAll} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', fontFamily: 'var(--font)' }}>
                {mealEntries.every(e => checked[e.id]) ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>

            {mealEntries.map(e => {
              const isChecked = !!checked[e.id]
              return (
                <div
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 2px', borderBottom: '0.5px solid var(--border)', gap: 10, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `1.5px solid ${isChecked ? 'var(--green)' : 'var(--border-md)'}`,
                    background: isChecked ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .12s',
                  }}>
                    {isChecked && <Check size={13} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.food_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.qty_g}g</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{Math.round(e.energie_kcal || 0)} kcal</span>
                </div>
              )
            })}
          </>
        )}

        <button
          className="btn-primary"
          onClick={handleImport}
          disabled={selectedEntries.length === 0}
          style={{ marginTop: 16, opacity: selectedEntries.length === 0 ? 0.5 : 1 }}
        >
          Ajouter {selectedEntries.length > 0 ? `${selectedEntries.length} aliment${selectedEntries.length > 1 ? 's' : ''}` : ''} à la liste
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
