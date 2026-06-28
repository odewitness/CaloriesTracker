import { useEffect, useRef } from 'react'

/**
 * Intercepts the Android/browser back button while a modal is open.
 *
 * How it works:
 *  - On mount, pushes a dummy history entry so the back button has somewhere
 *    to "go back to" without leaving the app.
 *  - On popstate (back button pressed), calls onBack() instead of navigating.
 *  - On unmount via UI (close/edit/delete buttons), silently neutralises the
 *    dummy entry with replaceState so no popstate fires and AppShell never
 *    sees a navigation event.
 *
 * Usage: call inside any modal component.
 *   useBackButton(onClose)
 */
export function useBackButton(onBack) {
  // True when the modal was dismissed by the hardware/browser back button.
  // False when dismissed programmatically (close button, edit, delete…).
  const closedByBackButton = useRef(false)

  useEffect(() => {
    closedByBackButton.current = false

    // Push a dummy state so the back button has an entry to pop.
    history.pushState({ modal: true }, '')

    const handlePop = () => {
      closedByBackButton.current = true
      onBack()
    }

    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)

      if (!closedByBackButton.current && history.state?.modal) {
        // The modal was closed by its own UI (not the back button).
        // Silently overwrite the dummy history entry in-place so the stack
        // stays clean without dispatching a popstate event.
        // This prevents AppShell's popstate listener from routing to 'today'.
        history.replaceState(null, '')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}