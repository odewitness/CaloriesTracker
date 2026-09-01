import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary — attrape les erreurs de rendu d'une sous-partie de l'app pour
// éviter l'écran blanc silencieux. Utilisé à plusieurs niveaux :
//   - une fois à la racine (App.jsx) : dernier filet de sécurité ;
//   - autour du contenu d'onglet et autour des modales plein écran : un plantage
//     dans un écran ne tue pas le reste de l'app.
//
// Props :
//   children
//   label     — nom de la zone pour le message ("cet écran" par défaut)
//   resetKey  — quand cette valeur change (ex. le pathname), on ré-essaie
//               automatiquement de rendre `children` (navigation = sortie de
//               l'état d'erreur sans recharger).
//   overlay   — true si on protège une modale plein écran : le fallback
//               s'affiche alors comme un panneau fixe par-dessus le reste.
// ─────────────────────────────────────────────────────────────────────────────
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, stack: '' }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur non interceptée :', error, info)
    this.setState({ stack: info?.componentStack || '' })
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, stack: '' })
    }
  }

  retry = () => this.setState({ error: null, stack: '' })

  render() {
    const { error, stack } = this.state
    if (!error) return this.props.children

    const label = this.props.label || 'cet écran'
    const overlayStyle = this.props.overlay
      ? { position: 'fixed', inset: 0, left: '50%', width: '100%', maxWidth: 430, transform: 'translateX(-50%)', background: 'var(--white)', zIndex: 250 }
      : {}
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60%', height: '100%', padding: '32px 24px', textAlign: 'center', gap: '14px',
        ...overlayStyle,
      }}>
        <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 700 }}>
          Un problème est survenu sur {label}
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
          Réessaie&nbsp;; si ça recommence, recharge l'application. Le reste de tes données n'est pas
          touché.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn-primary"
            style={{ width: 'auto', padding: '10px 20px' }}
            onClick={this.retry}
          >
            Réessayer
          </button>
          {this.props.onClose && (
            <button
              style={{
                width: 'auto', padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'none', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font)',
                fontSize: 13,
              }}
              onClick={() => { this.retry(); this.props.onClose() }}
            >
              Fermer
            </button>
          )}
          <button
            style={{
              width: 'auto', padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font)',
              fontSize: 13,
            }}
            onClick={() => window.location.reload()}
          >
            Recharger l'app
          </button>
        </div>
        <details style={{ marginTop: 6, maxWidth: 340, width: '100%' }}>
          <summary style={{ fontSize: 11.5, color: 'var(--text-hint)', cursor: 'pointer' }}>
            Détail technique
          </summary>
          <pre style={{
            marginTop: 6, padding: 10, borderRadius: 8, background: 'var(--gray-bg)',
            fontSize: 10.5, color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'pre-wrap',
            overflowX: 'auto', maxHeight: 180,
          }}>
            {String(error?.message || error)}{stack ? `\n${stack}` : ''}
          </pre>
        </details>
      </div>
    )
  }
}
