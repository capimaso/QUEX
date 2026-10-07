import {
  selectOne,
  supabaseRequest,
  updateOne,
} from './_lib/db.js'
import {
  requireUser,
  buildPublicUser,
} from './_lib/auth.js'
import { resolveAdmin } from './_lib/admin.js'
import {
  badRequest,
  forbidden,
  json,
  methodNotAllowed,
  notFound,
  ok,
  readBody,
  serverError,
  unauthorized,
} from './_lib/http.js'
import {
  avatarExists,
  deleteAvatar,
  isValidAvatarPath,
} from './_lib/storage.js'
import {
  buildStoredAddress,
  lookupCep,
  ViaCepError,
} from './_lib/viacep.js'
import { tryGeocodeAddress } from './_lib/geocoding.js'
import { deleteAccountData } from './_lib/accountDeletion.js'

const clean = value => String(value ?? '').trim()
const digits = value => clean(value).replace(/\D/g, '')
const BIO_MAX = 500

async function requireAdminActor(req, res) {
  const actor = await resolveAdmin(req)

  if (!actor.user) {
    unauthorized(res)
    return null
  }

  if (!actor.allowed) {
    forbidden(res, 'Apenas ADM ou CEO pode acessar esta área.')
    return null
  }

  return actor
}

async function listNotifications(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const rows = await supabaseRequest(
    `/notificacao?select=id,tipo,titulo,mensagem,link,lida,data_criacao&usuario_id=eq.${encodeURIComponent(user.id)}&order=data_criacao.desc&limit=20`
  )

  const unreadRows = await supabaseRequest(
    `/notificacao?select=id&usuario_id=eq.${encodeURIComponent(user.id)}&lida=eq.false`
  )

  return ok(res, {
    notifications: (rows || []).map(row => ({
      id: Number(row.id),
      type: row.tipo,
      title: row.titulo,
      message: row.mensagem,
      link: row.link || '/',
      read: Boolean(row.lida),
      created_at: row.data_criacao,
    })),
    unread_count: (unreadRows || []).length,
  })
}

async function markNotificationRead(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const id = Number(req.query?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Notificação inválida.')
  }

  const row = await updateOne(
    'notificacao',
    `id=eq.${encodeURIComponent(id)}&usuario_id=eq.${encodeURIComponent(user.id)}`,
    { lida: true }
  )

  if (!row) {
    return notFound(res, 'Notificação não encontrada.')
  }

  return ok(res, { ok: true })
}

async function markAllNotificationsRead(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  await supabaseRequest(
    `/notificacao?usuario_id=eq.${encodeURIComponent(user.id)}&lida=eq.false`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ lida: true }),
    }
  )

  return ok(res, { ok: true })
}

async function deleteOwnAccount(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const result = await deleteAccountData({
    targetUserId: Number(user.id),
    actorUserId: Number(user.id),
    adminMode: false,
  })

  return ok(res, {
    ok: true,
    auth_deleted: result.auth_deleted,
  })
}

async function adminDeleteUser(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const id = Number(req.query?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Usuário inválido.')
  }

  const result = await deleteAccountData({
    targetUserId: id,
    actorUserId: Number(actor.user.id),
    adminMode: true,
  })

  return ok(res, {
    ok: true,
    user_id: id,
    auth_deleted: result.auth_deleted,
  })
}

async function adminListProducts(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const rows = await supabaseRequest(
    '/produto?select=id,vendedor_id,nome,preco,ativo,retido,motivo_retencao,retido_em,retido_por&order=id.desc'
  )

  const sellerIds = [
    ...new Set((rows || []).map(row => Number(row.vendedor_id)).filter(Boolean)),
  ]

  const sellers = sellerIds.length
    ? await supabaseRequest(
        `/vendedor?select=id,comercial&id=in.(${sellerIds.join(',')})`
      )
    : []

  const sellerMap = new Map(
    (sellers || []).map(row => [Number(row.id), row.comercial || 'Vendedor'])
  )

  return ok(res, {
    products: (rows || []).map(row => ({
      id: Number(row.id),
      seller_id: Number(row.vendedor_id),
      seller_name: sellerMap.get(Number(row.vendedor_id)) || 'Vendedor',
      name: row.nome || '',
      price: Number(row.preco || 0),
      active: Boolean(row.ativo),
      retained: Boolean(row.retido),
      retention_reason: row.motivo_retencao || '',
      retained_at: row.retido_em || null,
      retained_by:
        row.retido_por == null ? null : Number(row.retido_por),
    })),
    viewer_level: actor.level,
  })
}

async function adminRetainProduct(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const id = Number(req.query?.id)
  const body = readBody(req)
  const reason = clean(body.motivo)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Anúncio inválido.')
  }

  if (reason.length < 5 || reason.length > 1000) {
    return badRequest(
      res,
      'Informe um motivo de retenção entre 5 e 1000 caracteres.'
    )
  }

  const product = await selectOne(
    'produto',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!product) return notFound(res, 'Anúncio não encontrado.')

  const updated = await updateOne(
    'produto',
    `id=eq.${encodeURIComponent(id)}`,
    {
      retido: true,
      ativo: false,
      motivo_retencao: reason,
      retido_em: new Date().toISOString(),
      retido_por: Number(actor.user.id),
    }
  )

  return ok(res, {
    product: {
      id: Number(updated.id),
      retained: Boolean(updated.retido),
      active: Boolean(updated.ativo),
      reason: updated.motivo_retencao || '',
    },
  })
}

async function adminReactivateProduct(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const id = Number(req.query?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Anúncio inválido.')
  }

  const product = await selectOne(
    'produto',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!product) return notFound(res, 'Anúncio não encontrado.')

  const updated = await updateOne(
    'produto',
    `id=eq.${encodeURIComponent(id)}`,
    {
      retido: false,
      ativo: true,
      motivo_retencao: null,
      retido_em: null,
      retido_por: null,
    }
  )

  return ok(res, {
    product: {
      id: Number(updated.id),
      retained: Boolean(updated.retido),
      active: Boolean(updated.ativo),
    },
  })
}

async function adminListOrders(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const orders = await supabaseRequest(
    '/pedido?select=id,comprador_id,status,data_criacao,valor_total&order=id.desc&limit=100'
  )

  const buyerIds = [
    ...new Set((orders || []).map(row => Number(row.comprador_id)).filter(Boolean)),
  ]

  const buyers = buyerIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome&id=in.(${buyerIds.join(',')})`
      )
    : []

  const buyerMap = new Map(
    (buyers || []).map(row => [Number(row.id), row.nome || 'Comprador'])
  )

  return ok(res, {
    orders: (orders || []).map(row => ({
      id: Number(row.id),
      buyer_id: Number(row.comprador_id),
      buyer_name: buyerMap.get(Number(row.comprador_id)) || 'Comprador',
      status: row.status,
      created_at: row.data_criacao,
      total: Number(row.valor_total || 0),
    })),
  })
}

async function adminGetOrder(req, res) {
  const actor = await requireAdminActor(req, res)
  if (!actor) return

  const id = Number(req.query?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Pedido inválido.')
  }

  const order = await selectOne(
    'pedido',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!order) return notFound(res, 'Pedido não encontrado.')

  const [items, deliveries] = await Promise.all([
    supabaseRequest(
      `/pedido_item?select=*&pedido_id=eq.${encodeURIComponent(id)}&order=id.asc`
    ),
    supabaseRequest(
      `/entrega?select=*&pedido_id=eq.${encodeURIComponent(id)}&order=id.asc`
    ),
  ])

  return ok(res, {
    order: {
      id: Number(order.id),
      buyer_id: Number(order.comprador_id),
      status: order.status,
      created_at: order.data_criacao,
      total: Number(order.valor_total || 0),
      items: items || [],
      deliveries: deliveries || [],
    },
  })
}

export default async function handler(req, res) {
  try {
    const resource = clean(req.query?.resource).toLowerCase()

    if (resource === 'notifications' && req.method === 'GET') {
      return listNotifications(req, res)
    }

    if (resource === 'notification_read' && req.method === 'PUT') {
      return markNotificationRead(req, res)
    }

    if (resource === 'notifications_read_all' && req.method === 'PUT') {
      return markAllNotificationsRead(req, res)
    }

    if (resource === 'delete_account' && req.method === 'DELETE') {
      return deleteOwnAccount(req, res)
    }

    if (resource === 'admin_delete_user' && req.method === 'DELETE') {
      return adminDeleteUser(req, res)
    }

    if (resource === 'admin_products' && req.method === 'GET') {
      return adminListProducts(req, res)
    }

    if (resource === 'admin_retain_product' && req.method === 'POST') {
      return adminRetainProduct(req, res)
    }

    if (resource === 'admin_reactivate_product' && req.method === 'POST') {
      return adminReactivateProduct(req, res)
    }

    if (resource === 'admin_orders' && req.method === 'GET') {
      return adminListOrders(req, res)
    }

    if (resource === 'admin_order' && req.method === 'GET') {
      return adminGetOrder(req, res)
    }

    if (!['PUT', 'PATCH'].includes(req.method)) {
      return methodNotAllowed(res, ['PUT', 'PATCH', 'DELETE', 'GET'])
    }

    const user = await requireUser(req)
    if (!user) return unauthorized(res)

    const body = req.body || {}

    return req.method === 'PATCH'
      ? await updatePhoto(res, user, body)
      : await updateProfile(res, user, body)
  } catch (error) {
    return serverError(res, error)
  }
}

async function updatePhoto(res, user, body) {
  const path =
    body.photo_path === null ||
    body.photo_path === ''
      ? null
      : clean(body.photo_path)

  if (path !== null) {
    if (!isValidAvatarPath(path, user.auth_user_id)) {
      return badRequest(res, 'Caminho de foto inválido.')
    }

    if (!(await avatarExists(path))) {
      return badRequest(
        res,
        'Não encontramos a foto enviada. Tenta de novo.'
      )
    }
  }

  const old = user.foto_perfil || null

  const updated = await updateOne(
    'usuario',
    `id=eq.${encodeURIComponent(user.id)}`,
    { foto_perfil: path }
  )

  if (old && old !== path) {
    await deleteAvatar(old)
  }

  return ok(res, {
    user: await buildPublicUser(
      updated || {
        ...user,
        foto_perfil: path,
      }
    ),
  })
}

async function resolveAddress(user, body) {
  const addressSent = [
    'cep',
    'numero',
    'complemento',
  ].some(key =>
    Object.prototype.hasOwnProperty.call(body, key)
  )

  const submittedCep = digits(body.cep)
  const submittedNumero = clean(body.numero)
  const submittedComplemento = clean(body.complemento)

  if (
    !addressSent ||
    (
      !submittedCep &&
      !submittedNumero &&
      !submittedComplemento &&
      !user.cep &&
      !user.numero
    )
  ) {
    return {
      cep: user.cep || null,
      numero: user.numero || null,
      complemento: user.complemento || null,
      cidade: user.cidade || null,
      uf: user.uf || null,
      lat: user.lat == null ? null : Number(user.lat),
      lng: user.lng == null ? null : Number(user.lng),
      endereco: user.endereco || '',
      localizacao:
        user.cidade && user.uf
          ? `${user.cidade} - ${user.uf}`
          : user.localizacao || null,
      geocodingWarning: null,
    }
  }

  const cep = digits(
    body.cep !== undefined
      ? body.cep
      : user.cep
  )

  const numero = clean(
    body.numero !== undefined
      ? body.numero
      : user.numero
  )

  const complemento = clean(
    body.complemento !== undefined
      ? body.complemento
      : user.complemento
  )

  if (!/^\d{8}$/.test(cep)) {
    throw new ViaCepError(
      'Informe um CEP válido com 8 dígitos.',
      'invalid_cep'
    )
  }

  if (!numero) {
    throw new ViaCepError(
      'Informe o número do endereço.',
      'invalid_address'
    )
  }

  if (numero.length > 30) {
    throw new ViaCepError(
      'O número do endereço é muito longo.',
      'invalid_address'
    )
  }

  if (complemento.length > 120) {
    throw new ViaCepError(
      'O complemento pode ter no máximo 120 caracteres.',
      'invalid_address'
    )
  }

  const cepData = await lookupCep(cep)
  const localizacao = `${cepData.cidade} - ${cepData.uf}`

  const geo = await tryGeocodeAddress({
    cep: cepData.cep,
    numero,
    logradouro: cepData.logradouro,
    bairro: cepData.bairro,
    cidade: cepData.cidade,
    uf: cepData.uf,
  })

  return {
    cep: cepData.cep,
    numero,
    complemento: complemento || null,
    cidade: cepData.cidade,
    uf: cepData.uf,
    lat: geo.lat,
    lng: geo.lng,
    geocodingWarning: geo.warning,
    localizacao,
    endereco: buildStoredAddress({
      numero,
      complemento,
      cepData,
    }),
  }
}

async function updateProfile(res, user, body) {
  const id = encodeURIComponent(user.id)
  const [buyer, seller] = await Promise.all([
    selectOne('comprador', `id=eq.${id}`),
    selectOne('vendedor', `id=eq.${id}`),
  ])

  if (
    body.cpf !== undefined &&
    buyer &&
    digits(body.cpf) !== digits(buyer.cpf)
  ) {
    return forbidden(
      res,
      'O CPF não pode ser alterado depois do cadastro.'
    )
  }

  if (
    body.cpf_cnpj !== undefined &&
    seller &&
    digits(body.cpf_cnpj) !== digits(seller.cpf_cnpj)
  ) {
    return forbidden(
      res,
      'O CPF/CNPJ não pode ser alterado depois do cadastro.'
    )
  }

  const requestedName = clean(body.name)
  const businessName =
    body.business_name !== undefined
      ? clean(body.business_name)
      : seller?.comercial || ''

  if (
    user.nome_imutavel &&
    requestedName &&
    requestedName !== user.nome
  ) {
    return forbidden(
      res,
      'Seu nome verificado não pode ser alterado.'
    )
  }

  const finalName =
    user.nome_imutavel
      ? user.nome
      : (
          requestedName ||
          businessName ||
          user.nome
        )

  const finalBusinessName =
    user.razao_social && seller
      ? finalName
      : businessName

  if (!finalName || finalName.length < 2) {
    return badRequest(res, 'Informe um nome válido.')
  }

  const phone = clean(body.phone)

  if (digits(phone).length < 10) {
    return badRequest(res, 'Informe um telefone válido.')
  }

  if (seller && !finalBusinessName) {
    return badRequest(
      res,
      'Informe o nome do estabelecimento ou nome fantasia.'
    )
  }

  const bio =
    body.bio !== undefined
      ? clean(body.bio)
      : user.bio || ''

  if (bio.length > BIO_MAX) {
    return badRequest(
      res,
      `A biografia pode ter no máximo ${BIO_MAX} caracteres.`
    )
  }

  let address

  try {
    address = await resolveAddress(user, body)
  } catch (error) {
    if (error instanceof ViaCepError) {
      return json(
        res,
        error.code === 'viacep_unavailable' ? 503 : 400,
        {
          error: error.message,
          code: error.code,
        }
      )
    }

    throw error
  }

  await updateOne(
    'usuario',
    `id=eq.${id}`,
    {
      nome: finalName,
      telefone: phone,
      endereco: address.endereco,
      bio: bio || null,
      localizacao: address.localizacao || null,
      cep: address.cep,
      numero: address.numero,
      complemento: address.complemento,
      cidade: address.cidade,
      uf: address.uf,
      lat: address.lat,
      lng: address.lng,
    }
  )

  if (seller) {
    await updateOne(
      'vendedor',
      `id=eq.${id}`,
      {
        comercial: finalBusinessName,
        localizacao: address.localizacao || '',
        entrega_propria:
          body.entrega_propria !== undefined
            ? Boolean(body.entrega_propria)
            : Boolean(seller.entrega_propria),
      }
    )
  }

  const fresh = await selectOne(
    'usuario',
    `id=eq.${id}`
  )

  return ok(res, {
    user: await buildPublicUser(fresh),
    geocoding_warning: address.geocodingWarning || null,
  })
}
