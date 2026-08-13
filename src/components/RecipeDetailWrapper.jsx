import React from 'react'
import { X } from 'lucide-react'
import RecipeDetailModal from './RecipeDetailModal'
import { useRecetteDetail } from '../hooks/useRecipes'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetailWrapper — charge une recette + ses ingrédients par id et
// affiche sa "page dédiée" (RecipeDetailModal). Extrait de ManualPage.jsx
// pour être réutilisable ailleurs (ex: cliquer sur une recette planifiée
// depuis le calendrier) sans dépendre de l'état d'une page en particulier.
//
// Props :
//   recetteId       — id de la recette à afficher
//   onClose()
//   onEdit()        — optionnel ; si absent, le bouton "Modifier" est masqué
//   onDelete()      — optionnel ; si absent, le bouton "Supprimer" est masqué
//   onPlan(source)  — optionnel ; si absent, le bouton "Planifier" est masqué
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDetailWrapper({ recetteId, onEdit, onDelete, onClose, onPlan }) {
  const { recette, ingredients, loading, updateIngredient } = useRecetteDetail(recetteId)

  if (loading || !recette) {
    return (
      <div className="page-modal">
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Recette</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        <Loader />
      </div>
    )
  }

  return (
    <RecipeDetailModal
      recette={recette}
      ingredients={ingredients}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
      onUpdateIngredient={updateIngredient}
      onPlan={onPlan}
    />
  )
}
