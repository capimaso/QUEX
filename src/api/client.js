import { supabase } from '@/lib/supabase'

async function accessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = await accessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  let data = null
  const text = await response.text()

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `Erro HTTP ${response.status}`
    )

    error.status = response.status
    error.code = data?.code || null
    error.details = data

    throw error
  }

  return data
}
