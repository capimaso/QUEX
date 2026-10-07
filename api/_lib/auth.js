import { selectOne, updateOne } from './db.js'
import { getAuthUser } from './supabaseAuth.js'
import { avatarUrl } from './storage.js'

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

export async function resolveAccount(req) {
  const token = getBearerToken(req)
  const authUser = await getAuthUser(token)
  if (!authUser?.id) return null

  const confirmed = Boolean(authUser.email_confirmed_at)

  let usuario = await selectOne(
    'usuario',
    `auth_user_id=eq.${encodeURIComponent(authUser.id)}`
  )

  if (!usuario && confirmed && authUser.email) {
    const legado = await selectOne(
      'usuario',
      `email=eq.${encodeURIComponent(String(authUser.email).toLowerCase())}&auth_user_id=is.null&banido_em=is.null&excluido_em=is.null`
    )

    if (legado) {
      usuario = await updateOne(
        'usuario',
        `id=eq.${encodeURIComponent(legado.id)}`,
        {
          auth_user_id: authUser.id,
          is_active: true,
        }
      )
    }
  }

  if (
    usuario &&
    !usuario.is_active &&
    !usuario.banido_em &&
    !usuario.excluido_em &&
    confirmed
  ) {
    usuario =
      (await updateOne(
        'usuario',
        `id=eq.${encodeURIComponent(usuario.id)}`,
        { is_active: true }
      )) || usuario
  }

  return {
    authUser,
    usuario: usuario || null,
  }
}

export async function requireUser(req) {
  const account = await resolveAccount(req)

  if (
    !account?.usuario ||
    !account.usuario.is_active ||
    account.usuario.banido_em ||
    account.usuario.excluido_em
  ) {
    return null
  }

  return account.usuario
}

export async function requireRole(req, role) {
  const user = await requireUser(req)
  if (!user) return { user: null, allowed: false }

  return {
    user,
    allowed: user.tipo === role,
  }
}

export function publicUser(user, extras = {}) {
  return {
    id: Number(user.id),
    email: user.email,
    full_name: user.nome,
    phone: user.telefone || '',
    address: user.endereco || '',
    cep: user.cep || '',
    numero: user.numero || '',
    complemento: user.complemento || '',
    cidade: user.cidade || '',
    uf: user.uf || '',
    lat: user.lat == null ? null : Number(user.lat),
    lng: user.lng == null ? null : Number(user.lng),
    birth_date: user.data_nasc || null,
    bio: user.bio || '',
    localizacao:
      user.cidade && user.uf
        ? `${user.cidade} - ${user.uf}`
        : user.localizacao || '',
    foto_perfil: user.foto_perfil || '',
    foto_url: avatarUrl(user.foto_perfil),
    role: user.tipo === 'vendedor' ? 'seller' : 'buyer',
    tipo: user.tipo,
    access_level: String(user.nivel_acesso || 'comum').toLowerCase(),
    legal_name: user.razao_social || '',
    name_immutable: Boolean(user.nome_imutavel),
    verification_pending: Boolean(user.verificacao_pendente),
    ...extras,
  }
}

export async function buildPublicUser(user, extras = {}) {
  const id = encodeURIComponent(user.id)

  const [buyer, seller] = await Promise.all([
    selectOne('comprador', `id=eq.${id}`),
    selectOne('vendedor', `id=eq.${id}`),
  ])

  const detail = {
    has_buyer_profile: Boolean(buyer),
    has_seller_profile: Boolean(seller),
    cpf: buyer?.cpf || '',
    cpf_cnpj: seller?.cpf_cnpj || '',
    business_name: seller?.comercial || '',
    entrega_propria: Boolean(seller?.entrega_propria),
    delivery_available: Boolean(seller?.entrega_disponivel),
    value_per_km:
      seller?.valor_por_km == null
        ? null
        : Number(seller.valor_por_km),
  }

  return publicUser(user, {
    ...detail,
    ...extras,
  })
}
