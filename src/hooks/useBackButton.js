import { useEffect, useRef } from 'react'

/**
 * Intercepts the Android/browser back button while a modal is open.
 *
 * Strategy:
 *  - On mount: push a dummy entry { modal: true } so back has somewhere to go.
 *  - On popstate: mark that back-button was used, then call onBack().
 *  - On unmount via UI (✕, edit, delete…): the dummy entry is already gone if
 *    back was pressed, or is left as a harmless orphan if not — either way we
 *    never call history.back() / history.go() here, so no spurious popstate
 *    fires and AppShell never navigates away.
 */
export function useBackButton(onBack) {
  const closedByBackButton = useRef(false)

  useEffect(() => {
    closedByBackButton.current = false
    history.pushState({ modal: true }, '')

    const handlePop = () => {
      closedByBackButton.current = true
      onBack()
    }

    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      // If the modal was closed by its own UI (not the back button), the dummy
      // entry is still on the stack. We neutralise it with replaceState so it
      // no longer carries { modal:true }, without firing any popstate event.
      // We do NOT call history.back() / go() — that would fire popstate and
      // trigger AppShell's listener, sending the user back to 'today'.
      if (!closedByBackButton.current) {
        history.replaceState({ modal: false }, '')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}