import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import toast from 'react-hot-toast'
import { apiRequest, AUTH_TOKEN_KEY, AUTH_USER_KEY, RENDER_API_URL } from '@/api/client'
import {
  callbackUrl,
  supabase,
} from '@/lib/supabase'

const AuthContext = createContext(null)
const EMPTY = { user: null, needsProfile: false, auth: null }

function storedUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    const user = raw ? JSON.parse(raw) : null
    return user && typeof user === 'object' && user.id
      ? user
      : null
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

function normalizeUser(user) {
  if (!user) return null

  const role =
    user.role ||
    (user.tipo === 'VENDEDOR' ? 'seller' : 'buyer')

  return {
    ...user,
    name: user.name || user.nome || '',
    role,
    has_buyer_profile:
      user.has_buyer_profile ?? role === 'buyer',
    has_seller_profile:
      user.has_seller_profile ?? role === 'seller',
  }
}

function apiUser(data) {
  return normalizeUser(data.user || data.usuario)
}

function erroAuth(error) {
  const code = error?.code || ''
  const msg = String(error?.message || '')
  const out = new Error(
    code === 'invalid_credentials' || /invalid login/i.test(msg)
      ? 'E-mail ou senha inválidos.'
      : code === 'email_not_confirmed' || /not confirmed/i.test(msg)
        ? 'Seu e-mail ainda não foi confirmado. Confere sua caixa de entrada.'
        : code === 'over_request_rate_limit' || error?.status === 429
          ? 'Muitas tentativas. Espera um pouquinho e tenta de novo.'
          : msg || 'Não foi possível entrar.'
  )

  out.code =
    code === 'email_not_confirmed' || /not confirmed/i.test(msg)
      ? 'email_not_confirmed'
      : code

  return out
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem(AUTH_TOKEN_KEY)
  )
  const [sessionReady, setSessionReady] = useState(false)
  const [account, setAccount] = useState(() => ({
    ...EMPTY,
    user: storedUser(),
  }))
  const [configured, setConfigured] = useState(Boolean(RENDER_API_URL))

  useEffect(() => {
    let active = true

    if (!token) {
      setAccount(EMPTY)
      setSessionReady(true)
      return () => {
        active = false
      }
    }

    setSessionReady(false)
    apiRequest('/api/auth/me')
      .then(data => {
        if (!active) return
        const user = apiUser(data)
        setAccount({
          user,
          needsProfile: Boolean(data.needs_profile),
          auth: data.auth || null,
        })
        if (user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
        }
      })
      .catch(error => {
        if (!active) return
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem(AUTH_TOKEN_KEY)
          localStorage.removeItem(AUTH_USER_KEY)
          setToken(null)
          setAccount(EMPTY)
        } else {
          setConfigured(false)
        }
      })
      .finally(() => {
        if (active) setSessionReady(true)
      })

    return () => {
      active = false
    }
  }, [token])

  const loading = !sessionReady
  const session = token
    ? { access_token: token, user: account.user }
    : null

  const refreshUser = async () => {
    const data = await apiRequest('/api/auth/me')
    const user = apiUser(data)

    setAccount({
      user,
      needsProfile: Boolean(data.needs_profile),
      auth: data.auth || null,
    })
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    }

    return user
  }

  const login = async (email, password) => {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const nextToken = data.token
    const user = apiUser(data)

    if (!nextToken || !user) {
      throw new Error('A API não retornou o token e o usuário do login.')
    }

    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    setToken(nextToken)
    setAccount({ ...EMPTY, user })
    return user
  }

  const register = async payload => {
    const address = [
      `${payload.rua}, ${payload.numero}`,
      payload.complemento,
      payload.bairro,
      `${payload.cidade}/${payload.uf}`,
      `CEP ${payload.cep}`,
    ]
      .filter(Boolean)
      .join(' - ')

    return apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        nome: payload.name,
        email: payload.email,
        senha: payload.password,
        telefone: payload.phone,
        endereco: address,
        data_nasc: payload.birth_date,
        tipo: payload.role === 'seller' ? 'VENDEDOR' : 'COMPRADOR',
        cpf: payload.cpf?.replace(/\D/g, ''),
        cpf_cnpj: payload.cpf_cnpj?.replace(/\D/g, ''),
        nome_loja: payload.business_name || payload.name,
        entrega_disponivel: payload.entrega_disponivel,
      }),
    })
  }

  const completeProfile = async payload => {
    const data = await apiRequest('/api/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const user = normalizeUser(data.user)

    setAccount({ user, needsProfile: false, auth: null })
    if (data.verification_warning) {
      toast(data.verification_warning, { icon: '⚠️' })
    }

    return user
  }

  const resendConfirmation = async email => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callbackUrl() },
    })

    if (error) throw erroAuth(error)
  }

  const logout = async () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setToken(null)
    setAccount(EMPTY)
    toast.success('Sessão encerrada.')
  }

  const capabilities = useMemo(() => {
    const user = account.user

    return {
      canBuy: Boolean(user?.has_buyer_profile),
      canSell: Boolean(user?.has_seller_profile),
      isAdmin:
        ['adm', 'ceo'].includes(
          String(user?.access_level || '').toLowerCase()
        ),
    }
  }, [account.user])

  const value = useMemo(
    () => ({
      token,
      user: account.user,
      needsProfile: account.needsProfile,
      authInfo: account.auth,
      session,
      loading,
      configured,
      capabilities,
      login,
      register,
      completeProfile,
      resendConfirmation,
      logout,
      refreshUser,
    }),
    [token, account, session, loading, configured, capabilities]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}
