import { useEffect } from 'react'

/**
 * Intercepts the Android/browser back button while a modal is open.
 *
 * How it works:
 *  - On mount, pushes a dummy history entry so the back button has somewhere
 *    to "go back to" without leaving the app.
 *  - On popstate (back button pressed), calls onBack() instead of navigating.
 *  - On unmount (modal closed normally), removes the dummy entry so the
 *    history stack stays clean.
 *
 * Usage: call inside any modal component.
 *   useBackButton(onClose)
 */
export function useBackButton(onBack) {
  useEffect(() => {
    // Push a dummy state so the back button has an entry to pop.
    history.pushState({ modal: true }, '')

    const handlePop = () => {
      onBack()
    }

    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      // If the modal was closed via its own UI (not back button), the dummy
      // entry is still on the stack — remove it cleanly.
      if (history.state?.modal) {
        history.back()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
