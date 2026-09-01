import React, { useState, useEffect } from 'react'
import { recipePhotoUrl } from '../lib/recipePhoto'

// ─────────────────────────────────────────────────────────────────────────────
// RecipePhoto — photo d'une recette dans une boîte à ratio fixe (object-fit
// cover, pas de recadrage manuel). Ne rend RIEN si la recette n'a pas de photo
// ou si le fichier n'existe pas (404) : les appelants peuvent donc la placer
// inconditionnellement, elle se replie en silence.
//
//   <RecipePhoto recetteId={r.id} version={r.photo_updated_at} />
//
// `eager` : tente de charger la photo même sans `version` (utile là où on veut
// être sûr de l'afficher quoi qu'il arrive, ex. la fiche recette — `version`
// peut manquer une fraction de seconde après un ajout). Sinon on n'essaie que
// si `version` est renseigné (évite un 404 par carte dans les listes).
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipePhoto({ recetteId, version, eager = false, ratio = '16 / 10', radius = 14, style }) {
  const shouldShow = eager ? !!recetteId : !!version
  const url = shouldShow ? recipePhotoUrl(recetteId, version || undefined) : null

  // Identité stable par recette : on ne remet `failed` à zéro que si on change
  // de recette, pas sur un simple changement de cache-buster (`?v=…`) — sinon
  // la fiche clignote « photo → vide → photo » quand la ligne se recharge.
  const [failedId, setFailedId] = useState(null)
  useEffect(() => { setFailedId(null) }, [recetteId])

  if (!url || failedId === recetteId) return null

  return (
    <div style={{ width: '100%', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', background: 'var(--gray-bg)', ...style }}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailedId(recetteId)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
