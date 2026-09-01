// Redimensionnement d'image côté client, sans dépendance (canvas natif).
// Utilisé pour les photos de profil (carré) et les photos de recette (paysage,
// ratio conservé). Sortie : Blob JPEG, ~15–40 Ko.
//
//   processImage(file, { maxSize: 256, square: true })   → avatar
//   processImage(file, { maxSize: 1024 })                → photo de recette

export async function processImage(file, { maxSize = 1024, square = false, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file)

  let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height
  if (square) {
    const side = Math.min(bitmap.width, bitmap.height)
    sx = (bitmap.width - side) / 2
    sy = (bitmap.height - side) / 2
    sw = sh = side
  }

  // Cible : on borne le plus grand côté à maxSize, en gardant le ratio.
  const scale = Math.min(1, maxSize / Math.max(sw, sh))
  const dw = Math.round(sw * scale)
  const dh = Math.round(sh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh)
  bitmap.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Conversion image impossible'))),
      'image/jpeg',
      quality,
    )
  })
}
