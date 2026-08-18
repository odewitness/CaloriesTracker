import React from 'react'
import { Plus } from 'lucide-react'
import { useMealSuggestions } from '../hooks/useMealSuggestions'
import { scaleFood } from '../lib/nutrients'

// ─────────────────────────────────────────────────────────────────────────────
// QuickAddSuggestions — rangée de chips "ajout en un tap" affichée en tête de
// la page Aujourd'hui, proposant les aliments les plus fréquents pour le
// repas du moment (voir getMealForTime dans lib/dates.js). Un tap ajoute
// directement au journal avec la dernière quantité connue — pas de feuille de
// confirmation, la quantité reste modifiable après coup comme n'importe
// quelle entrée du journal (c'est le but : un geste, pas un formulaire).
// ─────────────────────────────────────────────────────────────────────────────
export default function QuickAddSuggestions({ meal, onAdd }) {
  const { suggestions, loading } = useMealSuggestions(meal)

  if (loading || suggestions.length === 0) return null

  const handleTap = (food) => {
    const qty = food.portions?.[0]?.g || 100
    onAdd({ meal, ...scaleFood(food, qty) })
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="section-title" style={{ marginBottom: 6 }}>Ajout rapide · {meal}</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
        {suggestions.map((food, i) => {
          const qty = food.portions?.[0]?.g || 100
          const kcal = Math.round(((food.energie_kcal || 0) * qty) / 100)
          return (
            <button
              key={i}
              onClick={() => handleTap(food)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                padding: '8px 12px', borderRadius: 999,
                background: 'var(--green-light)', border: '1px solid var(--green)',
                color: 'var(--green-dark)', fontSize: 12.5, fontWeight: 600,
                fontFamily: 'var(--font)', whiteSpace: 'nowrap',
              }}
            >
              <Plus size={13} />
              {food.alim_nom} · {kcal} kcal
            </button>
          )
        })}
      </div>
    </div>
  )
}
