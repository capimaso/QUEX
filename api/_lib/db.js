// Usa só a origem (https://xxxx.supabase.co), mesmo que colem ".../rest/v1" na env.
function normalizeUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin } catch { return value.replace(/\/+$/, '') }
}
const SUPABASE_URL = normalizeUrl(process.env.SUPABASE_URL)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function requireDbConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase não está configurado no servidor. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  }
}

export function getSupabaseUrl() {
  requireDbConfig()
  return SUPABASE_URL
}

function makeHeaders(extra = {}) {
  requireDbConfig()
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function parse(response) {
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.hint || data?.details || `Supabase HTTP ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.details = data
    throw error
  }
  return data
}

export async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1${path}`, {
    ...options,
    headers: makeHeaders(options.headers),
  })
  return parse(response)
}

export async function supabaseRpc(name, body = {}) {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: makeHeaders(),
    body: JSON.stringify(body),
  })
  return parse(response)
}

export function first(value) {
  return Array.isArray(value) ? (value[0] || null) : value
}

export async function selectOne(table, query) {
  const rows = await supabaseRequest(`/${table}?select=*&${query}&limit=1`)
  return first(rows)
}

export async function insertOne(table, payload) {
  const rows = await supabaseRequest(`/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return first(rows)
}

export async function updateOne(table, query, payload) {
  const rows = await supabaseRequest(`/${table}?${query}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return first(rows)
}

export async function deleteWhere(table, query) {
  return supabaseRequest(`/${table}?${query}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}
