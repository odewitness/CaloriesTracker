import React from 'react'
import FoodPicker from './FoodPicker'
import { scaleFood } from '../lib/nutrients'

// ─────────────────────────────────────────────────────────────────────────────
// AddFoodModal — ajoute un aliment au journal du jour.
// Toute la logique de recherche/favoris/récents/code-barres vit désormais dans
// FoodPicker (partagée avec RecipeFormModal) ; ce composant ne fait plus que
// définir le contexte propre au journal : le repas ciblé et le format d'entrée
// attendu par useJournal.addEntry.
// ─────────────────────────────────────────────────────────────────────────────
export default function AddFoodModal({ initialMeal, onAdd, onClose }) {
  const meal = initialMeal || 'Déjeuner' // fixé par le "+" sur lequel on a cliqué

  const handleConfirm = async (food, qty) => {
    const entry = { meal, ...scaleFood(food, qty) }
    await onAdd(entry)
  }

  return (
    <FoodPicker
      title="Ajouter un aliment"
      confirmLabel="Ajouter au journal"
      contextLabel={<>Ajout à : <strong style={{ color: 'var(--text)' }}>{meal}</strong></>}
      includeRecipes={true}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  )
}