import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/me')
      .then(data => { if (active) setUser(data.user || null) })
      .catch(error => {
        if (active) {
          setUser(null)
          if (error.status !== 401) setConfigured(false)
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const login = async (email, password) => {
    const data = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    setUser(data.user)
    return data
  }

  const register = async payload => {
    const data = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
    setUser(data.user)
    return data
  }

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    toast.success('Sessão encerrada.')
  }

  const refreshUser = async () => {
    const data = await apiRequest('/api/auth/me')
    setUser(data.user || null)
    return data.user
  }

  const value = useMemo(() => ({ user, loading, configured, login, register, logout, refreshUser }), [user, loading, configured])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
