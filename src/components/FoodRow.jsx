import React from 'react'
import { Star } from 'lucide-react'

export default function FoodRow({ food, isFav, onSelect, onToggleFav }) {
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
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)', flexShrink: 0 }}>{food.energie_kcal} kcal/100g</span>
    </div>
  )
}
