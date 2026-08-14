import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// useWakeLock — "mode cuisine" : empêche l'écran de se mettre en veille tant
// qu'il est actif (ex: en train de suivre une recette). Le navigateur libère
// automatiquement le wake lock quand l'onglet passe en arrière-plan ; on le
// redemande au retour au premier plan si l'utilisatrice l'avait activé.
// ─────────────────────────────────────────────────────────────────────────────
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const wakeLockRef = useRef(null)
  const activeRef = useRef(false)

  const request = useCallback(async () => {
    if (!supported) return
    try {
      const lock = await navigator.wakeLock.request('screen')
      wakeLockRef.current = lock
      activeRef.current = true
      setActive(true)
      // Le navigateur peut libérer le lock lui-même (ex: onglet caché) sans
      // passer par release() : on l'oublie pour permettre une reprise via
      // le listener visibilitychange ci-dessous.
      lock.addEventListener('release', () => { wakeLockRef.current = null })
    } catch {
      activeRef.current = false
      setActive(false)
    }
  }, [supported])

  const release = useCallback(async () => {
    activeRef.current = false
    setActive(false)
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release() } catch {}
      wakeLockRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    if (activeRef.current) release()
    else request()
  }, [request, release])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (activeRef.current && document.visibilityState === 'visible' && !wakeLockRef.current) {
        request()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [request])

  // Libère le wake lock quand l'écran qui l'a activé se démonte (ex: on
  // quitte la recette), pour ne pas garder l'écran allumé ailleurs sans que
  // ce soit visible pour l'utilisatrice.
  useEffect(() => () => {
    if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {})
  }, [])

  return { active, supported, toggle }
}
