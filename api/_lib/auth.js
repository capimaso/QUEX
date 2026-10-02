import { selectOne, updateOne } from './db.js'
import { getAuthUser } from './supabaseAuth.js'
import { avatarUrl } from './storage.js'

// A identidade (senha, Google, confirmação de e-mail) vive no Supabase Auth.
// A tabela `usuario` guarda os dados do QUÉX e aponta pro Supabase via auth_user_id.

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

// Descobre quem está chamando a API.
// Retorna { authUser, usuario } — `usuario` é null se ainda falta completar o cadastro (ex.: 1º login com Google).
// Retorna null se o token for inválido.
export async function resolveAccount(req) {
  const token = getBearerToken(req)
  const authUser = await getAuthUser(token)
  if (!authUser?.id) return null
  const confirmed = Boolean(authUser.email_confirmed_at)

  let usuario = await selectOne('usuario', `auth_user_id=eq.${encodeURIComponent(authUser.id)}`)

  // Conta antiga (criada antes do Supabase Auth) com o mesmo e-mail JÁ confirmado: vincula.
  if (!usuario && confirmed && authUser.email) {
    const legado = await selectOne('usuario', `email=eq.${encodeURIComponent(String(authUser.email).toLowerCase())}&auth_user_id=is.null`)
    if (legado) {
      usuario = await updateOne('usuario', `id=eq.${encodeURIComponent(legado.id)}`, { auth_user_id: authUser.id, is_active: true })
    }
  }

  // Segurança extra caso o trigger do banco não tenha rodado.
  if (usuario && !usuario.is_active && confirmed) {
    usuario = (await updateOne('usuario', `id=eq.${encodeURIComponent(usuario.id)}`, { is_active: true })) || usuario
  }
  return { authUser, usuario: usuario || null }
}

export async function requireUser(req) {
  const account = await resolveAccount(req)
  if (!account?.usuario || !account.usuario.is_active) return null
  return account.usuario
}

export async function requireRole(req, role) {
  const user = await requireUser(req)
  if (!user) return { user: null, allowed: false }
  return { user, allowed: user.tipo === role }
}

export function publicUser(user, extras = {}) {
  return {
    id: Number(user.id),
    email: user.email,
    full_name: user.nome,
    phone: user.telefone || '',
    address: user.endereco || '',
    birth_date: user.data_nasc || null,
    bio: user.bio || '',
    localizacao: user.localizacao || '',
    foto_perfil: user.foto_perfil || '',
    foto_url: avatarUrl(user.foto_perfil),
    role: user.tipo === 'vendedor' ? 'seller' : 'buyer',
    tipo: user.tipo,
    ...extras,
  }
}

// publicUser + dados de comprador/vendedor
export async function buildPublicUser(user, extras = {}) {
  let detail
  if (user.tipo === 'vendedor') {
    const seller = await selectOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`)
    detail = {
      cpf_cnpj: seller?.cpf_cnpj || '',
      business_name: seller?.comercial || '',
      localizacao: user.localizacao || seller?.localizacao || '',
      entrega_propria: Boolean(seller?.entrega_propria),
    }
  } else {
    const buyer = await selectOne('comprador', `id=eq.${encodeURIComponent(user.id)}`)
    detail = { cpf: buyer?.cpf || '' }
  }
  return publicUser(user, { ...detail, ...extras })
}
