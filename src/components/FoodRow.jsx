import React from 'react'
import { Star } from 'lucide-react'
import { getNutriBadge } from '../lib/nutriBadge'
import { getRichMicroClaims, portionGapCoverage, formatValue } from '../lib/ciqualExplorer'

// Écrit en toutes lettres, seule l'initiale en minuscule (« vitamine C »
// perdrait sa lettre autrement) — même règle que ExplorerRow.
function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

// top10Gaps (optionnel) : les 10 manques du jour les plus urgents, transmis
// depuis AddFoodModal quand ce picker sert à ajouter au journal du jour. Sans
// lui (ex: RecipeFormModal, qui n'a pas de notion de "manque du jour"), ce
// bloc ne s'affiche simplement pas.
export default function FoodRow({ food, isFav, onSelect, onToggleFav, top10Gaps }) {
  const badge = getNutriBadge(food)
  const micro = getRichMicroClaims(food, 1)[0]

  // Parmi ces 10 manques, celui que la PORTION HABITUELLE de cet aliment
  // (voir portionGapCoverage) couvre le mieux — même moteur que les
  // suggestions de la page du jour (TodayGapsSection), pas forcément le
  // manque n°1 : un aliment peut être médiocre sur le plus urgent mais
  // excellent sur un autre.
  let bestGapMatch = null
  for (const gap of top10Gaps || []) {
    const c = portionGapCoverage(food, gap)
    if (!c) continue
    if (!bestGapMatch || c.pct > bestGapMatch.coverage.pct) bestGapMatch = { gap, coverage: c }
  }
  const coverage = bestGapMatch?.coverage

  return (
    <div
      onClick={() => onSelect(food)}
      style={{ display: 'flex', alignItems: 'center', padding: '10px 4px', borderBottom: '0.5px solid var(--border)', cursor: 'pointer', gap: 8 }}
    >
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(food) }}
        className="btn-icon"
        style={{ flexShrink: 0, color: isFav ? 'var(--amber)' : 'var(--text-hint)' }}
        aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <Star size={16} fill={isFav ? 'var(--amber)' : 'none'} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{food.alim_nom}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {food._source === 'off' ? (food.marque || food.categorie) : food.categorie}
          {food._source === 'custom' && <span style={{ marginLeft: 6, background: 'var(--purple-light)', color: 'var(--purple)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Perso</span>}
          {food._source === 'off' && <span style={{ marginLeft: 6, background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>OFF</span>}
          {food._source === 'recette' && <span style={{ marginLeft: 6, background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Mes recettes</span>}
        </div>
        {(badge || micro || coverage) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {badge && (
              <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                {badge.emoji} {badge.label}
              </span>
            )}
            {micro && (
              <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                Riche en {lowerFirst(micro.label)}
              </span>
            )}
            {coverage && (
              <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                {coverage.pct >= 100
                  ? `${formatValue(coverage.grams, 'g')} comblent ton manque en ${lowerFirst(bestGapMatch.gap.field.label)}`
                  : `${formatValue(coverage.grams, 'g')} comblent ${coverage.pct}% de ton manque en ${lowerFirst(bestGapMatch.gap.field.label)}`}
              </span>
            )}
          </div>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0 }}>{food.energie_kcal} kcal/100g</span>
    </div>
  )
}
