import { getSupabaseUrl } from './db.js'

// Fotos de produto: bucket público "produtos", em <auth uid>/<arquivo>.
// produto.fotos_url guarda um JSON com a lista de "refs" (ordem = ordem de exibição, a 1ª é a capa).
// Cada ref é um CAMINHO do Storage ("<uid>/123.jpg") ou, em produtos antigos, uma URL completa.
// Produtos antigos (fotos_url com uma URL solta) continuam funcionando.
export const PRODUCT_BUCKET = 'produtos'
export const MAX_PHOTOS = 6
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9._-]{1,100}\.(jpe?g|png|webp)$/i

export const isHttpUrl = ref => /^https?:\/\//i.test(String(ref || ''))

export function parsePhotoRefs(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const list = JSON.parse(text)
      return Array.isArray(list) ? list.filter(item => typeof item === 'string' && item.trim()).slice(0, MAX_PHOTOS) : []
    } catch { return [] }
  }
  return [text] // formato antigo: uma URL só
}

export const serializePhotoRefs = refs => (refs.length ? JSON.stringify(refs) : null)

export function photoUrl(ref) {
  if (!ref) return ''
  if (isHttpUrl(ref)) return ref
  const safe = String(ref).split('/').map(encodeURIComponent).join('/')
  return `${getSupabaseUrl()}/storage/v1/object/public/${PRODUCT_BUCKET}/${safe}`
}

export const photoUrls = raw => parsePhotoRefs(raw).map(photoUrl)
export const firstPhotoUrl = (raw, fallback = '') => photoUrls(raw)[0] || fallback

// O caminho precisa estar DENTRO da pasta do próprio vendedor.
export function isValidProductPath(path, authUserId) {
  const p = String(path || '')
  return PATH_RE.test(p) && !p.includes('..') && p.toLowerCase().startsWith(`${String(authUserId || '').toLowerCase()}/`)
}

async function exists(ref) {
  try { return (await fetch(photoUrl(ref), { method: 'HEAD' })).ok } catch { return false }
}

// Valida a lista que veio do front. `current` = refs que o produto já tem (podem ser URLs antigas).
export async function validatePhotoRefs(input, authUserId, current = []) {
  if (!Array.isArray(input)) return { error: 'Lista de fotos inválida.' }
  const refs = [...new Set(input.map(item => String(item ?? '').trim()).filter(Boolean))]
  if (refs.length > MAX_PHOTOS) return { error: `Máximo de ${MAX_PHOTOS} fotos por produto.` }
  for (const ref of refs) {
    if (current.includes(ref)) continue // já era do produto
    if (isHttpUrl(ref)) return { error: 'Envie as fotos pelo botão de upload (links externos não são aceitos).' }
    if (!isValidProductPath(ref, authUserId)) return { error: 'Caminho de foto inválido.' }
    if (!(await exists(ref))) return { error: 'Não encontramos uma das fotos enviadas. Tenta de novo.' }
  }
  return { refs }
}

// Apaga do Storage só o que é arquivo nosso (URL antiga é ignorada). Melhor esforço.
export async function deletePhotoFiles(refs) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  for (const ref of refs || []) {
    if (!ref || isHttpUrl(ref)) continue
    const safe = String(ref).split('/').map(encodeURIComponent).join('/')
    await fetch(`${getSupabaseUrl()}/storage/v1/object/${PRODUCT_BUCKET}/${safe}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }).catch(() => {})
  }
}
