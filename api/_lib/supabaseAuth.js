// Fala com o Supabase Auth (GoTrue) pelo servidor.
// - verifica o token que o navegador manda (Authorization: Bearer ...)
// - cria conta com e-mail de confirmação
// - ações de admin (criar/apagar usuário) usando a service role
import { getSupabaseUrl } from './db.js'

const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const MENSAGENS = {
  weak_password: 'Senha fraca demais. Use pelo menos 6 caracteres.',
  email_exists: 'Este e-mail já está cadastrado.',
  user_already_exists: 'Este e-mail já está cadastrado.',
  email_address_invalid: 'Esse e-mail não parece válido.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Espera uns minutinhos e tenta de novo.',
  over_request_rate_limit: 'Muitas tentativas. Espera um pouco e tenta de novo.',
  signup_disabled: 'Cadastro desativado no Supabase (Authentication > Sign In / Providers).',
}

async function gotrue(path, { method = 'GET', apikey, bearer, body } = {}) {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1${path}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${bearer || apikey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!response.ok) {
    const code = data?.error_code || data?.code
    const error = new Error(MENSAGENS[code] || data?.msg || data?.message || data?.error_description || `Auth HTTP ${response.status}`)
    error.status = response.status
    error.code = code
    throw error
  }
  return data
}

// Devolve o usuário do Supabase Auth dono do token, ou null se o token for inválido/expirado.
export async function getAuthUser(token) {
  if (!token) return null
  try {
    return await gotrue('/user', { apikey: SERVICE_KEY(), bearer: token })
  } catch (error) {
    if (error.status === 401 || error.status === 403) return null
    throw error
  }
}

// Cadastro normal: o Supabase manda o e-mail de confirmação (se estiver ligado no painel).
export async function signUpWithEmail({ email, password, data, redirectTo }) {
  const anon = ANON_KEY()
  if (!anon) throw new Error('Defina SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) na Vercel.')
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ''
  const result = await gotrue(`/signup${query}`, { method: 'POST', apikey: anon, body: { email, password, data } })
  return result?.user || result
}

export async function adminCreateUser({ email, password, metadata }) {
  return gotrue('/admin/users', {
    method: 'POST',
    apikey: SERVICE_KEY(),
    body: { email, password, email_confirm: true, user_metadata: metadata },
  })
}

export async function adminDeleteUser(id) {
  return gotrue(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', apikey: SERVICE_KEY() })
}
