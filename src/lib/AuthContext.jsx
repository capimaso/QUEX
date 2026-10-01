import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { getCurrentUser, getSession, isSupabaseConfigured, setSession, signIn, signOut, signUp } from '@/lib/supabaseRest'
import { getProfile } from '@/api/data'

const AuthContext = createContext(null)

async function hydrateUser(authUser) {
  if (!authUser) return null
  const profile = await getProfile(authUser.id).catch(() => null)
  return {
    id: authUser.id,
    email: authUser.email || profile?.email || '',
    ...profile,
    full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
    role: profile?.role || authUser.user_metadata?.role || 'buyer',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured] = useState(isSupabaseConfigured)

  useEffect(() => {
    let active = true
    async function boot() {
      if (!configured) {
        setLoading(false)
        return
      }
      try {
        const session = getSession()
        if (session?.access_token) {
          const authUser = await getCurrentUser()
          if (active && authUser) setUser(await hydrateUser(authUser))
        }
      } catch (error) {
        console.error(error)
        setSession(null)
      } finally {
        if (active) setLoading(false)
      }
    }
    boot()
    return () => { active = false }
  }, [configured])

  const login = async (email, password) => {
    const data = await signIn(email, password)
    setUser(await hydrateUser(data.user))
    return data
  }

  const register = async (payload) => {
    const { email, password, ...profile } = payload
    const data = await signUp(email, password, {
      full_name: profile.full_name,
      role: profile.role,
      cpf: profile.cpf || null,
      cpf_cnpj: profile.cpf_cnpj || null,
      phone: profile.phone,
      business_name: profile.business_name || null,
    })
    if (data?.session) {
      setSession(data.session)
      setUser(await hydrateUser(data.user))
    }
    return data
  }

  const logout = async () => {
    await signOut()
    setUser(null)
    toast.success('Sessão encerrada.')
  }

  const refreshUser = async () => {
    const authUser = await getCurrentUser()
    const hydrated = await hydrateUser(authUser)
    setUser(hydrated)
    return hydrated
  }

  const value = useMemo(() => ({ user, loading, configured, login, register, logout, refreshUser }), [user, loading, configured])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
