import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Apple } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import Loader from '../components/Loader'

export default function ResetPasswordPage() {
  const { session, authLoading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/today', { replace: true }), 1500)
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader />
      </div>
    )
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Apple size={28} color="var(--green-dark)" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>NutriTrack</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Choisis un nouveau mot de passe
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        {!session ? (
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Ce lien de réinitialisation est invalide ou a expiré. Redemande un lien depuis la page de connexion.
          </div>
        ) : done ? (
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
            Mot de passe mis à jour. Redirection...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Field icon={<Lock size={15} />} placeholder="Nouveau mot de passe" value={password} onChange={setPassword} type="password" autoComplete="new-password" style={{ marginBottom: 10 }} />
            <Field icon={<Lock size={15} />} placeholder="Confirme le mot de passe" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" style={{ marginBottom: 4 }} />

            {error && (
              <div style={{ color: 'var(--coral)', fontSize: 12, marginTop: 10, lineHeight: 1.4 }}>{error}</div>
            )}

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 16, opacity: loading ? 0.7 : 1 }}>
              {loading ? '...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ icon, placeholder, value, onChange, type = 'text', autoComplete, style }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)', display: 'flex' }}>{icon}</span>
      <input
        className="input"
        style={{ paddingLeft: 34 }}
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
