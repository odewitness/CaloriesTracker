import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  // showToast(msg) / showToast(msg, durationMs) / showToast(msg, { duration, action: { label, onClick } })
  const showToast = useCallback((msg, opts = {}) => {
    const { duration = 2000, action = null } = typeof opts === 'number' ? { duration: opts } : (opts || {})
    const id = ++idRef.current
    setToasts(t => [...t, { id, msg, action }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span>{t.msg}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => { t.action.onClick(); dismiss(t.id) }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
