import { supabase } from './supabase'
import { processImage } from './image'

// Photo de profil : bucket Storage public `avatars`, un fichier par compte à
// un chemin déterministe basé sur l'id auth (`<user_id>/avatar.jpg`). Comme
// chaque ligne du fil social porte déjà `auteur_id`, n'importe quel client
// peut reconstruire l'URL publique de la photo d'une amie sans lire son
// `profiles` (RLS restrictif) ni dénormaliser un champ de plus.
//
// « Cette personne a-t-elle une photo ? » n'est pas testé en amont : le
// composant <Avatar> tente de charger l'image et retombe sur la pastille à
// initiales si elle renvoie 404.

export const AVATAR_BUCKET = 'avatars'

// Chemin du fichier dans le bucket (upsert : on écrase toujours le même).
export function avatarPath(userId) {
  return `${userId}/avatar.jpg`
}

// URL publique de la photo d'un compte. `version` (un timestamp ISO, en
// pratique profile.avatar_updated_at) sert de cache-buster : utile pour SA
// PROPRE photo juste après changement. Pour la photo d'une amie on n'a pas
// cette valeur → on sert l'URL nue et on accepte le cache CDN (~1 h).
export function avatarPublicUrl(userId, version) {
  if (!userId) return null
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath(userId))
  if (!data?.publicUrl) return null
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl
}

// Initiales à afficher dans la pastille de repli (2 lettres max).
export function initialsOf(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Couleur de fond stable dérivée du nom, pour distinguer les pastilles entre
// elles dans le fil. Teintes douces cohérentes avec la palette de l'app.
const AVATAR_COLORS = [
  ['#e8f0e3', '#4a6b3d'],
  ['#e5eef2', '#3d5f6b'],
  ['#f2e8e5', '#8a5a44'],
  ['#ece5f2', '#5c4a6b'],
  ['#f2efe0', '#6b6335'],
  ['#e0f2ec', '#356b5c'],
]

export function avatarColors(name) {
  const s = String(name || '?')
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Recadre l'image en carré et la borne à 256 px (cf. lib/image.js).
export const processAvatarImage = (file) => processImage(file, { maxSize: 256, square: true })
