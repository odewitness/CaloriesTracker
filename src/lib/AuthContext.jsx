import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async ({ email, password, prenom, nom, age, poids_kg }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // Le trigger SQL crée déjà une ligne profiles vide — on la complète.
    if (data.user) {
      await supabase.from('profiles').update({
        prenom: prenom || null,
        nom: nom || null,
        age: age || null,
        poids_kg: poids_kg || null,
      }).eq('id', data.user.id)
    }
    return { data, error: null }
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    authLoading,
    signUp,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
