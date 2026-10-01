import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { apiRequest } from '@/api/client'
import { callbackUrl, isSupabaseConfigured, supabase } from '@/lib/supabase'

const AuthContext = createContext(null)
const EMPTY = { user: null, needsProfile: false, auth: null }

function erroAuth(error) {
  const code = error?.code || ''
  const msg = String(error?.message || '')
  const out = new Error(
    code === 'invalid_credentials' || /invalid login/i.test(msg) ? 'E-mail ou senha inválidos.'
      : code === 'email_not_confirmed' || /not confirmed/i.test(msg) ? 'Seu e-mail ainda não foi confirmado. Confere sua caixa de entrada.'
      : code === 'over_request_rate_limit' || error?.status === 429 ? 'Muitas tentativas. Espera um pouquinho e tenta de novo.'
      : msg || 'Não foi possível entrar.'
  )
  out.code = code === 'email_not_confirmed' || /not confirmed/i.test(msg) ? 'email_not_confirmed' : code
  return out
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [account, setAccount] = useState(EMPTY)
  const [resolvedFor, setResolvedFor] = useState(null)
  const [configured, setConfigured] = useState(isSupabaseConfigured)

  // 1) acompanha a sessão do Supabase (login, logout, refresh, link de e-mail, Google)
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionReady(true)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  // 2) quando muda quem está logado, busca o cadastro dele no QUÉX
  const userId = session?.user?.id || null
  useEffect(() => {
    if (!sessionReady) return
    if (!userId) { setAccount(EMPTY); setResolvedFor(null); return }
    let active = true
    apiRequest('/api/auth/me')
      .then(data => { if (active) setAccount({ user: data.user || null, needsProfile: Boolean(data.needs_profile), auth: data.auth || null }) })
      .catch(error => {
        if (!active) return
        setAccount(EMPTY)
        if (error.status !== 401) setConfigured(false)
      })
      .finally(() => { if (active) setResolvedFor(userId) })
    return () => { active = false }
  }, [sessionReady, userId])

  const loading = !sessionReady || (Boolean(userId) && resolvedFor !== userId)

  const refreshUser = async () => {
    const data = await apiRequest('/api/auth/me')
    setAccount({ user: data.user || null, needsProfile: Boolean(data.needs_profile), auth: data.auth || null })
    return data.user || null
  }

  const login = async (email, password) => {
    let { error } = await supabase.auth.signInWithPassword({ email, password })
    // Conta antiga (criada antes do Supabase Auth): confere a senha antiga e migra na hora.
    if (error && (error.code === 'invalid_credentials' || /invalid login/i.test(error.message || ''))) {
      try {
        await apiRequest('/api/auth/legacy-login', { method: 'POST', body: JSON.stringify({ email, password }) })
        ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
      } catch (legacyError) {
        if (legacyError.status === 409) throw legacyError // pede pra redefinir a senha
      }
    }
    if (error) throw erroAuth(error)
    return refreshUser()
  }

  // Cadastro: a API cria tudo e o Supabase manda o e-mail de confirmação.
  const register = async payload => apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, redirect_to: callbackUrl() }),
  })

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(), queryParams: { prompt: 'select_account' } },
    })
    if (error) throw erroAuth(error)
  }

  const completeProfile = async payload => {
    const data = await apiRequest('/api/auth/complete-profile', { method: 'POST', body: JSON.stringify(payload) })
    setAccount({ user: data.user, needsProfile: false, auth: null })
    return data.user
  }

  const resendConfirmation = async email => {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl() } })
    if (error) throw erroAuth(error)
  }

  const logout = async () => {
    await supabase.auth.signOut().catch(() => {})
    setAccount(EMPTY)
    toast.success('Sessão encerrada.')
  }

  const value = useMemo(() => ({
    user: account.user,
    needsProfile: account.needsProfile,
    authInfo: account.auth,
    session,
    loading,
    configured,
    login, register, loginWithGoogle, completeProfile, resendConfirmation, logout, refreshUser,
  }), [account, session, loading, configured])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
