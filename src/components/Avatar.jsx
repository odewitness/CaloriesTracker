import React, { useState, useEffect } from 'react'
import { avatarPublicUrl, initialsOf, avatarColors } from '../lib/avatar'

// ─────────────────────────────────────────────────────────────────────────────
// Avatar — photo de profil ronde d'un compte, avec repli automatique sur une
// pastille à initiales colorée si la personne n'a pas (encore) de photo ou si
// le chargement échoue (404 sur le fichier Storage).
//
//   <Avatar userId={partage.auteur_id} name={auteurLabel} size={26} />
//
// `version` (profile.avatar_updated_at) n'est utile que pour SA PROPRE photo,
// pour forcer le rafraîchissement juste après un changement.
// ─────────────────────────────────────────────────────────────────────────────
export default function Avatar({ userId, name, size = 32, version, style }) {
  const url = avatarPublicUrl(userId, version)
  const [failed, setFailed] = useState(!url)

  // Nouveau userId / nouvelle version → on retente le chargement de l'image.
  useEffect(() => { setFailed(!url) }, [url])

  const [bg, fg] = avatarColors(name)
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    objectFit: 'cover',
    display: 'block',
    ...style,
  }

  if (failed) {
    return (
      <div
        style={{
          ...base,
          background: bg,
          color: fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: Math.round(size * 0.4),
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ ...base, background: bg }}
    />
  )
}
