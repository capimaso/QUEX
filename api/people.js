import { selectOne, supabaseRequest } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { badRequest, notFound, ok, serverError, unauthorized } from './_lib/http.js'
import { avatarUrl } from './_lib/storage.js'

// Perfis públicos (só o que a view perfil_publico expõe: nome, foto, bio, localização, nota).
//
//  GET /api/people?id=7                                 -> um perfil (comprador ou vendedor)
//  GET /api/people?search=zé&location=palhoça&limit=24  -> lista de VENDEDORES

// minúsculo, sem acento e sem caracteres que quebrariam o filtro do PostgREST
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9\s.'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

function mapPerson(row) {
  return {
    id: Number(row.id),
    role: row.tipo === 'vendedor' ? 'seller' : 'buyer',
    name: row.nome_exibicao || row.nome || '',
    responsible: row.comercial && row.nome && row.comercial !== row.nome ? row.nome : '',
    bio: row.bio || '',
    localizacao: row.localizacao || '',
    foto_url: avatarUrl(row.foto_perfil),
    rating: { average: row.media == null ? null : Number(row.media), count: Number(row.total || 0) },
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const viewer = await requireUser(req)
    if (!viewer) return unauthorized(res)

    if (req.query?.id !== undefined) {
      const id = Number(req.query.id)
      if (!Number.isInteger(id) || id <= 0) return badRequest(res, 'Perfil inválido.')
      const row = await selectOne('perfil_publico', `id=eq.${id}`)
      return row ? ok(res, { person: mapPerson(row) }) : notFound(res, 'Perfil não encontrado.')
    }

    const search = fold(req.query?.search)
    const location = fold(req.query?.location)
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 24, 1), 60)
    const offset = Math.max(parseInt(req.query?.offset, 10) || 0, 0)
    const conditions = ['tipo=eq.vendedor']
    if (search) conditions.push(`nome_busca=ilike.${encodeURIComponent(`*${search}*`)}`)
    if (location) conditions.push(`local_busca=ilike.${encodeURIComponent(`*${location}*`)}`)
    const order = 'order=media.desc.nullslast,total.desc,nome_exibicao.asc'
    const rows = await supabaseRequest(`/perfil_publico?select=*&${conditions.join('&')}&${order}&limit=${limit}&offset=${offset}`)
    return ok(res, { people: (rows || []).map(mapPerson), limit, offset })
  } catch (error) {
    return serverError(res, error)
  }
}
