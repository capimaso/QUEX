const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SESSION_KEY = 'quex_supabase_session'

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

function requireConfig() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function setSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

async function refreshSession() {
  const current = getSession()
  if (!current?.refresh_token) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  })
  if (!response.ok) {
    setSession(null)
    return null
  }
  const next = await response.json()
  setSession(next)
  return next
}

async function authFetch(url, options = {}, retry = true) {
  requireConfig()
  const session = getSession()
  const token = session?.access_token
  const headers = new Headers(options.headers || {})
  headers.set('apikey', SUPABASE_ANON_KEY)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  else headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`)

  const response = await fetch(url, { ...options, headers })
  if (response.status === 401 && retry && token) {
    const refreshed = await refreshSession()
    if (refreshed?.access_token) return authFetch(url, options, false)
  }
  return response
}

async function parseResponse(response) {
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.hint || data?.details || `Supabase HTTP ${response.status}`
    throw new Error(message)
  }
  return data
}

export async function restRequest(path, options = {}) {
  const response = await authFetch(`${SUPABASE_URL}/rest/v1${path}`, options)
  return parseResponse(response)
}

export async function rpc(functionName, body = {}) {
  const response = await authFetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return parseResponse(response)
}

export async function signUp(email, password, metadata = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: metadata }),
  })
  return parseResponse(response)
}

export async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseResponse(response)
  setSession(data)
  return data
}

export async function getCurrentUser() {
  const session = getSession()
  if (!session?.access_token) return null
  const response = await authFetch(`${SUPABASE_URL}/auth/v1/user`)
  if (response.status === 401) {
    setSession(null)
    return null
  }
  return parseResponse(response)
}

export async function signOut() {
  const session = getSession()
  if (session?.access_token && isSupabaseConfigured) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {})
  }
  setSession(null)
}

export async function requestPasswordReset(email) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirect_to: `${window.location.origin}/reset-password` }),
  })
  return parseResponse(response)
}

export async function updatePassword(password) {
  const response = await authFetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  })
  return parseResponse(response)
}
