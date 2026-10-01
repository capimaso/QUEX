export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { credentials: 'include', ...options, headers })
  let data = null
  const text = await response.text()
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Erro HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return data
}
