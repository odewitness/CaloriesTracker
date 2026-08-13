import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Mail, Lock, User, Calendar, Scale, Apple } from 'lucide-react'

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [age, setAge] = useState('')
  const [poids, setPoids] = useState('')

  const reset = () => { setError(''); setForgotSent(false) }

  const handleSignIn = async (e) => {
    e.preventDefault()
    reset()
    if (!email || !password) { setError('Remplis tous les champs.'); return }
    setLoading(true)
    const { error } = await signIn({ email: email.trim(), password })
    setLoading(false)
    if (error) setError(traduireErreur(error.message))
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    reset()
    if (!email || !password) { setError('Email et mot de passe sont obligatoires.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    const { error } = await signUp({
      email: email.trim(),
      password,
      prenom: prenom.trim(),
      nom: nom.trim(),
      age: age ? parseInt(age) : null,
      poids_kg: poids ? parseFloat(poids) : null,
    })
    setLoading(false)
    if (error) setError(traduireErreur(error.message))
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) { setError('Renseigne ton email.'); return }
    setLoading(true)
    const { error } = await resetPassword(email.trim())
    setLoading(false)
    if (error) setError(traduireErreur(error.message))
    else setForgotSent(true)
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Apple size={28} color="var(--green-dark)" />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>NutriTrack</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {mode === 'signin' ? 'Connecte-toi à ton compte' : mode === 'signup' ? 'Crée ton compte' : 'Réinitialise ton mot de passe'}
        </div>
      </div>

      {mode === 'forgot' ? (
        <form onSubmit={handleForgot} className="card" style={{ padding: 18 }}>
          {forgotSent ? (
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
              Un email vient de t'être envoyé avec un lien pour choisir un nouveau mot de passe.
            </div>
          ) : (
            <>
              <Field icon={<Mail size={15} />} placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
              {error && (
                <div style={{ color: 'var(--coral)', fontSize: 12, marginTop: 10, lineHeight: 1.4 }}>{error}</div>
              )}
              <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 16, opacity: loading ? 0.7 : 1 }}>
                {loading ? '...' : 'Envoyer le lien'}
              </button>
            </>
          )}
        </form>
      ) : (
      <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="card" style={{ padding: 18 }}>
        {mode === 'signup' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <Field icon={<User size={15} />} placeholder="Prénom" value={prenom} onChange={setPrenom} />
              <Field icon={<User size={15} />} placeholder="Nom" value={nom} onChange={setNom} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <Field icon={<Calendar size={15} />} placeholder="Âge" value={age} onChange={setAge} type="number" />
              <Field icon={<Scale size={15} />} placeholder="Poids (kg)" value={poids} onChange={setPoids} type="number" step="0.1" />
            </div>
          </>
        )}

        <Field icon={<Mail size={15} />} placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" style={{ marginBottom: 10 }} />
        <Field icon={<Lock size={15} />} placeholder="Mot de passe" value={password} onChange={setPassword} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} style={{ marginBottom: 4 }} />

        {error && (
          <div style={{ color: 'var(--coral)', fontSize: 12, marginTop: 10, lineHeight: 1.4 }}>{error}</div>
        )}

        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 16, opacity: loading ? 0.7 : 1 }}>
          {loading ? '...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
        </button>

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => { setMode('forgot'); reset() }}
            style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
          >
            Mot de passe oublié ?
          </button>
        )}
      </form>
      )}

      <button
        onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); reset() }}
        style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font)' }}
      >
        {mode === 'signin'
          ? <>Pas encore de compte ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>S'inscrire</span></>
          : mode === 'signup'
          ? <>Déjà un compte ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>Se connecter</span></>
          : <>Retour à la <span style={{ color: 'var(--green)', fontWeight: 600 }}>connexion</span></>}
      </button>
    </div>
  )
}

function Field({ icon, placeholder, value, onChange, type = 'text', autoComplete, style, step }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)', display: 'flex' }}>{icon}</span>
      <input
        className="input"
        style={{ paddingLeft: 34 }}
        type={type}
        step={step}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function traduireErreur(msg) {
  if (/invalid login credentials/i.test(msg)) return 'Email ou mot de passe incorrect.'
  if (/user already registered/i.test(msg)) return 'Un compte existe déjà avec cet email.'
  if (/email not confirmed/i.test(msg)) return 'Confirme ton email avant de te connecter (vérifie ta boîte mail).'
  if (/password should be at least/i.test(msg)) return 'Le mot de passe doit faire au moins 6 caractères.'
  if (/unable to validate email/i.test(msg)) return 'Adresse email invalide.'
  return msg
}
