import React, { useState, useEffect } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { User, Calendar, Scale, Mail, LogOut, UserCircle } from 'lucide-react'

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      <div style={{ color: 'var(--green)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 14 }}>{label}</div>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const toast = useToast()
  const { user, signOut } = useAuth()
  const { profile, loading, updateProfile } = useProfile()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [age, setAge] = useState('')
  const [poids, setPoids] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setPrenom(profile.prenom || '')
      setNom(profile.nom || '')
      setAge(profile.age ?? '')
      setPoids(profile.poids_kg ?? '')
    }
  }, [profile])

  const markDirty = (setter) => (v) => { setter(v); setDirty(true) }

  const save = async () => {
    setSaving(true)
    const { error } = await updateProfile({
      prenom: prenom.trim() || null,
      nom: nom.trim() || null,
      age: age !== '' ? parseInt(age) : null,
      poids_kg: poids !== '' ? parseFloat(poids) : null,
    })
    setSaving(false)
    if (!error) { toast('✓ Profil mis à jour !'); setDirty(false) }
    else toast('Erreur lors de la sauvegarde')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (loading) return <div className="loader"><div className="spinner" /> Chargement...</div>

  const initials = ((prenom?.[0] || '') + (nom?.[0] || '')).toUpperCase() || (user?.email?.[0] || '?').toUpperCase()

  return (
    <div className="page-content">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
          {initials}
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{prenom || nom ? `${prenom} ${nom}`.trim() : 'Mon profil'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
      </div>

      <div className="section-title">Informations personnelles</div>
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <Row icon={<User size={18} />} label="Prénom">
          <input className="input-sm" style={{ width: 120, textAlign: 'left' }} value={prenom} onChange={e => markDirty(setPrenom)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<User size={18} />} label="Nom">
          <input className="input-sm" style={{ width: 120, textAlign: 'left' }} value={nom} onChange={e => markDirty(setNom)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<Calendar size={18} />} label="Âge">
          <input className="input-sm" type="number" value={age} onChange={e => markDirty(setAge)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<Scale size={18} />} label="Poids (kg)">
          <input className="input-sm" type="number" step="0.1" value={poids} onChange={e => markDirty(setPoids)(e.target.value)} placeholder="—" />
        </Row>
        <Row icon={<Mail size={18} />} label="Email">
          <span style={{ fontSize: 13, color: 'var(--text-hint)' }}>{user?.email}</span>
        </Row>
      </div>

      {dirty && (
        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginBottom: 16, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : '💾 Sauvegarder le profil'}
        </button>
      )}

      <button
        onClick={handleSignOut}
        className="card"
        style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--coral)', fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600 }}
      >
        <LogOut size={18} />
        Se déconnecter
      </button>
    </div>
  )
}
