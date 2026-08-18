import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Erreur non interceptée :', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '32px', textAlign: 'center', gap: '16px',
      }}>
        <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 700 }}>
          Une erreur inattendue s'est produite
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Recharge la page pour continuer. Si le problème persiste, réessaie plus tard.
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '12px 24px' }}
          onClick={() => window.location.reload()}
        >
          Recharger
        </button>
      </div>
    )
  }
}
