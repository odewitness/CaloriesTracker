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
//   initialRecette  — optionnel ; recette déjà connue (ex: carte cliquée dans
//                   une liste déjà chargée). Permet d'afficher l'écran final
//                   immédiatement au lieu d'un écran de chargement générique,
//                   le temps que les ingrédients arrivent.
//   onClose()
//   onEdit()        — optionnel ; si absent, le bouton "Modifier" est masqué
//   onDelete()      — optionnel ; si absent, le bouton "Supprimer" est masqué
//   onShare()       — optionnel ; si absent, l'item "Partager" est masqué
//   onPlan(source)  — optionnel ; si absent, le bouton "Planifier" est masqué
//   onAddToJournal(items, recette) — optionnel ; si absent, le bouton
//                   "Ajouter au journal" est masqué
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDetailWrapper({ recetteId, initialRecette, onEdit, onDelete, onShare, onClose, onPlan, onAddToJournal, initialPortions }) {
  const { recette, ingredients, loading, updateIngredient } = useRecetteDetail(recetteId)
  const displayRecette = recette || initialRecette

  if (!displayRecette) {
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
      recette={displayRecette}
      ingredients={ingredients}
      ingredientsLoading={loading}
      onEdit={onEdit}
      onDelete={onDelete}
      onShare={onShare ? () => onShare(displayRecette, ingredients) : undefined}
      onClose={onClose}
      onUpdateIngredient={updateIngredient}
      onPlan={onPlan}
      onAddToJournal={onAddToJournal}
      initialPortions={initialPortions}
    />
  )
}
