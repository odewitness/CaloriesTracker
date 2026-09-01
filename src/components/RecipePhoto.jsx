import React, { useState, useRef, useEffect } from 'react'
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
// être sûr de l'afficher, ex. la fiche recette). Sinon on n'essaie que si
// `version` est renseigné (évite un 404 par carte dans les listes).
//
// L'URL est FIGÉE pour toute la durée de vie de la fiche : on retient le
// premier `version` non vide vu pour cette recette et on ne le « rétrograde »
// jamais (quand la ligne se recharge, `photo_updated_at` peut manquer une
// fraction de seconde, ou être sérialisé différemment). Sans ça, la photo
// clignotait « visible → vide → visible » à l'ouverture.
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipePhoto({ recetteId, version, eager = false, ratio = '16 / 10', radius = 14, style }) {
  const pinned = useRef({ id: null, v: null })
  if (pinned.current.id !== recetteId) {
    pinned.current = { id: recetteId, v: version || null }
  } else if (version && !pinned.current.v) {
    pinned.current.v = version
  }
  const effectiveVersion = pinned.current.v

  const [loadedOk, setLoadedOk] = useState(false)
  const [errored, setErrored] = useState(false)
  useEffect(() => { setLoadedOk(false); setErrored(false) }, [recetteId])

  const shouldShow = eager ? !!recetteId : !!effectiveVersion
  if (!shouldShow) return null
  if (errored && !loadedOk) return null

  const url = recipePhotoUrl(recetteId, effectiveVersion || undefined)
  if (!url) return null

  return (
    <div style={{ width: '100%', aspectRatio: ratio, flexShrink: 0, borderRadius: radius, overflow: 'hidden', background: 'var(--gray-bg)', ...style }}>
      <img
        key={recetteId}
        src={url}
        alt=""
        loading="lazy"
        onLoad={() => setLoadedOk(true)}
        onError={() => setErrored(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
