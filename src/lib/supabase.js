import { createClient } from '@supabase/supabase-js'

// Chave PÚBLICA (anon/publishable). A service role NUNCA entra aqui.
// Aceita qualquer coisa colada na env (ex.: ".../rest/v1/") e usa só a origem: https://xxxx.supabase.co
export function normalizeSupabaseUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin
  } catch {
    return value.replace(/\/+$/, '')
  }
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const url = normalizeSupabaseUrl(rawUrl)
if (rawUrl && url && rawUrl.trim().replace(/\/+$/, '') !== url) {
  console.warn(`[QUÉX] VITE_SUPABASE_URL tinha um caminho extra e foi ajustada para ${url}. Use só a URL base do projeto.`)
}
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Guarda erro que o Supabase manda na URL (ex.: link de confirmação expirado) ANTES do cliente limpar a URL.
function readUrlError() {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    return hash.get('error_description') || query.get('error_description') || null
  } catch { return null }
}
export const initialUrlError = readUrlError()

export const isSupabaseConfigured = Boolean(url && key)

// Se faltar env, cria um cliente "vazio" só pra o app abrir e mostrar o aviso de configuração.
export const supabase = createClient(url || 'http://localhost:54321', key || 'sem-chave', {
  auth: {
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const callbackUrl = () => `${window.location.origin}/auth/callback`
