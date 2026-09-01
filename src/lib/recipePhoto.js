import { supabase } from './supabase'
import { processImage } from './image'

// Photo de recette : bucket Storage public `recette-photos`, un fichier par
// recette à `<recette_id>/photo.jpg` (upsert). Même principe que les avatars
// (cf. lib/avatar.js) : le chemin est déterministe à partir de l'id, donc une
// amie qui voit une recette partagée peut reconstruire l'URL depuis
// `partages_recettes.recette_id` sans lire la table `recettes` (RLS « own »).
//
// `recettes.photo_updated_at` (et sa copie dénormalisée
// `partages_recettes.photo_updated_at`, posée au moment du partage) indique
// s'il y a une photo et sert de cache-buster.

export const RECIPE_PHOTO_BUCKET = 'recette-photos'

export function recipePhotoPath(recetteId) {
  return `${recetteId}/photo.jpg`
}

export function recipePhotoUrl(recetteId, version) {
  if (!recetteId) return null
  const { data } = supabase.storage.from(RECIPE_PHOTO_BUCKET).getPublicUrl(recipePhotoPath(recetteId))
  if (!data?.publicUrl) return null
  return version ? `${data.publicUrl}?v=${encodeURIComponent(version)}` : data.publicUrl
}

// Compresse (paysage, ratio conservé, borné à 1024 px) puis écrase le fichier
// de la recette. Renvoie { photoUpdatedAt } en cas de succès, { error } sinon.
async function setPhotoUpdatedAt(recetteId, userId, value) {
  let q = supabase.from('recettes').update({ photo_updated_at: value }).eq('id', recetteId)
  if (userId) q = q.eq('user_id', userId)
  return q
}

export async function uploadRecipePhoto(recetteId, file, userId) {
  if (!recetteId) return { error: 'Recette inconnue' }
  let blob
  try {
    blob = await processImage(file, { maxSize: 1024 })
  } catch (e) {
    return { error: e.message || 'Image illisible' }
  }
  const { error: upErr } = await supabase.storage
    .from(RECIPE_PHOTO_BUCKET)
    .upload(recipePhotoPath(recetteId), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
  if (upErr) return { error: upErr.message || 'Envoi impossible' }

  const photoUpdatedAt = new Date().toISOString()
  const { error: dbErr } = await setPhotoUpdatedAt(recetteId, userId, photoUpdatedAt)
  if (dbErr) return { error: dbErr.message || 'Enregistrement impossible' }
  return { photoUpdatedAt }
}

export async function removeRecipePhoto(recetteId, userId) {
  if (!recetteId) return { error: 'Recette inconnue' }
  const { error: rmErr } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove([recipePhotoPath(recetteId)])
  if (rmErr) return { error: rmErr.message || 'Suppression impossible' }
  const { error: dbErr } = await setPhotoUpdatedAt(recetteId, userId, null)
  if (dbErr) return { error: dbErr.message || 'Enregistrement impossible' }
  return {}
}
