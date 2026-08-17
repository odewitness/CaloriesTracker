import React from 'react'
import { Lightbulb, Plus } from 'lucide-react'
import { formatValue } from '../lib/ciqualExplorer'

// ─────────────────────────────────────────────────────────────────────────────
// ComboSuggestion — bandeau affiché quand AUCUN aliment seul des résultats ne
// comble bien les manques cochés dans le budget de calories restant (voir
// suggestCombo dans ciqualExplorer.js et son appel dans ExplorerPage, qui ne
// rend ce composant que si la paire fait significativement mieux qu'un
// aliment seul). Répond directement à la manière dont on mange en vrai — un
// peu de deux aliments plutôt qu'une grosse portion d'un seul.
//
// `combo` : { foods: [{ food, grams }, { food, grams }], pct }
// `onQuickAdd(food, grams)` : réutilise le même ajout rapide que les cartes
// de la liste (voir ExplorerPage.handleQuickAdd) — pas de flux séparé à
// maintenir.
// ─────────────────────────────────────────────────────────────────────────────
export default function ComboSuggestion({ combo, onQuickAdd }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: 'var(--green-light)', borderRadius: 'var(--radius-sm)',
      padding: '10px 12px', marginBottom: 10,
    }}>
      <Lightbulb size={15} style={{ color: 'var(--green-dark)', flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--green-dark)', lineHeight: 1.4, marginBottom: 6 }}>
          Aucun aliment seul ne comble bien tes manques dans ce budget. À deux, ça marche mieux
          {combo.pct < 100 ? ` (${combo.pct} % couverts)` : ''} :
        </div>
        {combo.foods.map(({ food, grams }) => (
          <div
            key={food.alim_code || food.id}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
          >
            <button
              onClick={() => onQuickAdd(food, grams)}
              className="btn-icon"
              style={{ width: 22, height: 22, flexShrink: 0, background: 'var(--white)', color: 'var(--green-dark)' }}
              aria-label={`Ajouter ${food.alim_nom} au journal`}
            >
              <Plus size={13} />
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--green-dark)' }}>
              <strong>{formatValue(grams, 'g')}</strong> de {food.alim_nom}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
