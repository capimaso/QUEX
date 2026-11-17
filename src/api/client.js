import axios from 'axios'

export const AUTH_TOKEN_KEY = 'quex_token'
export const AUTH_USER_KEY = 'quex_user'
export const RENDER_API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || ''

const apiClient = axios.create({
  baseURL: RENDER_API_URL,
})

apiClient.interceptors.request.use(config => {
  const path = String(config.url || '')
  const method = String(config.method || 'get').toLowerCase()
  const privateRenderRequest =
    path === '/api/auth/me' ||
    (path.startsWith('/api/produtos') &&
      !['get', 'head', 'options'].includes(method))
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (token && privateRenderRequest) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export async function apiRequest(path, options = {}) {
  const useRenderApi =
    ['/api/auth/login', '/api/auth/register', '/api/auth/me'].includes(path) ||
    path.startsWith('/api/produtos')

  try {
    const response = await apiClient.request({
      url: path,
      method: options.method || 'GET',
      data: options.body,
      headers: options.headers,
      baseURL: useRenderApi ? RENDER_API_URL : '',
    })

    return response.data
  } catch (cause) {
    const data = cause.response?.data
    const error = new Error(
      data?.error ||
        data?.message ||
        data?.mensagem ||
        cause.message ||
        'Não foi possível conectar à API.'
    )

    error.status = cause.response?.status
    error.code = data?.code || null
    error.details = data || null

    throw error
  }
}
