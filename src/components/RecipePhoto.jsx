import React, { useState, useEffect } from 'react'
import { recipePhotoUrl } from '../lib/recipePhoto'

// ─────────────────────────────────────────────────────────────────────────────
// RecipePhoto — photo d'une recette dans une boîte à ratio fixe (object-fit
// cover, pas de recadrage manuel). Ne rend RIEN si la recette n'a pas de photo
// (`version` absent) ou si le fichier n'existe pas (404) : les appelants
// peuvent donc la placer inconditionnellement, elle se replie en silence.
//
//   <RecipePhoto recetteId={r.id} version={r.photo_updated_at} />
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipePhoto({ recetteId, version, ratio = '16 / 10', radius = 14, style }) {
  const url = version ? recipePhotoUrl(recetteId, version) : null
  // `failed` = ce fichier renvoie 404. On le ré-évalue quand l'URL de base
  // change (autre recette / photo remplacée) mais PAS sur un simple changement
  // de cache-buster, pour ne pas faire clignoter la fiche.
  const baseUrl = url ? url.split('?')[0] : null
  const [failedBase, setFailedBase] = useState(null)

  useEffect(() => { setFailedBase(null) }, [baseUrl])

  if (!url || failedBase === baseUrl) return null

  return (
    <div style={{ width: '100%', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', background: 'var(--gray-bg)', ...style }}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailedBase(baseUrl)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
