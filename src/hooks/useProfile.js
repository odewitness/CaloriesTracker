import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { AVATAR_BUCKET, avatarPath, processAvatarImage } from '../lib/avatar'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data || null)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const updateProfile = async (patch) => {
    if (!user) return { error: 'Non connecté' }
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()
    if (!error) setProfile(data)
    return { data, error }
  }

  // Photo de profil : compresse côté client puis écrase le fichier unique du
  // compte dans le bucket `avatars`. `avatar_updated_at` sert de cache-buster
  // pour l'affichage immédiat de sa propre photo (cf. lib/avatar.js).
  const uploadAvatar = async (file) => {
    if (!user) return { error: 'Non connecté' }
    let blob
    try {
      blob = await processAvatarImage(file)
    } catch (e) {
      return { error: e.message || 'Image illisible' }
    }
    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath(user.id), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
    if (upErr) return { error: upErr.message || 'Envoi impossible' }
    return updateProfile({ avatar_updated_at: new Date().toISOString() })
  }

  const removeAvatar = async () => {
    if (!user) return { error: 'Non connecté' }
    const { error: rmErr } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(user.id)])
    if (rmErr) return { error: rmErr.message || 'Suppression impossible' }
    return updateProfile({ avatar_updated_at: null })
  }

  return { profile, loading, updateProfile, uploadAvatar, removeAvatar, refetch: fetchProfile }
}
