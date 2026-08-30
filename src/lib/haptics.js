// Retour haptique discret (vibration). Supporté sur Android/Chrome ;
// iOS Safari n'implémente pas navigator.vibrate → l'appel est silencieusement
// ignoré. Volontairement bref (≈10 ms) : jamais de vibration longue ou
// répétée qui donnerait une impression de bug plutôt que de retour tactile.
//
// Toutes les fonctions sont sûres à appeler sans garde : elles ne lèvent
// jamais et ne font rien si l'API est absente.

export function haptic(pattern = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* certains navigateurs lèvent si l'API est bridée (iframe, permission) */
  }
}

// Intentions nommées, pour que les call-sites restent lisibles.
export const hapticTap = () => haptic(10)                 // ajout / validation simple
export const hapticRemove = () => haptic([12, 28, 12])    // suppression : deux petites impulsions
export const hapticNav = () => haptic(8)                  // changement de jour (swipe)
export const hapticSuccess = () => haptic([10, 40, 10, 40, 18]) // moment « réussi » (objectif atteint)
