import { getSupabaseUrl } from './db.js'

// Fotos de perfil ficam no bucket público "avatars", em <auth uid>/<arquivo>.
// No banco guardamos só o CAMINHO (usuario.foto_perfil); a URL é montada aqui.
const BUCKET = 'avatars'
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,100}\.(jpe?g|png|webp)$/i

// O caminho precisa estar DENTRO da pasta do próprio usuário (impede apontar pra foto de outro).
export function isValidAvatarPath(path, authUserId) {
  const p = String(path || '')
  return PATH_RE.test(p) && !p.includes('..') && p.toLowerCase().startsWith(`${String(authUserId || '').toLowerCase()}/`)
}

export function avatarUrl(path) {
  if (!path) return ''
  const safe = String(path).split('/').map(encodeURIComponent).join('/')
  return `${getSupabaseUrl()}/storage/v1/object/public/${BUCKET}/${safe}`
}

export async function avatarExists(path) {
  try {
    const response = await fetch(avatarUrl(path), { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// Apaga a foto antiga (melhor esforço: se falhar, só sobra um arquivo órfão)
export async function deleteAvatar(path) {
  if (!path) return
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const safe = String(path).split('/').map(encodeURIComponent).join('/')
  await fetch(`${getSupabaseUrl()}/storage/v1/object/${BUCKET}/${safe}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).catch(() => {})
}
