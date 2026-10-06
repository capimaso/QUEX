import {
  insertOne,
  selectOne,
  supabaseRequest,
  supabaseRpc,
  updateOne,
} from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { resolveAdmin } from './_lib/admin.js'
import {
  badRequest,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  readBody,
  serverError,
  unauthorized,
} from './_lib/http.js'
import { effectivePrice } from './_lib/pricing.js'
import {
  calculateShipping,
  validateCoordinates,
} from './_lib/shipping.js'
import MockPaymentProvider from './_lib/payment/MockPaymentProvider.js'

const round2 = value =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100

const clean = value => String(value ?? '').trim()

async function requireBuyer(req, res) {
  const user = await requireUser(req)

  if (!user) {
    unauthorized(res)
    return null
  }

  if (user.tipo !== 'comprador') {
    forbidden(res, 'Somente compradores podem usar este recurso.')
    return null
  }

  return user
}

async function requireSeller(req, res) {
  const user = await requireUser(req)

  if (!user) {
    unauthorized(res)
    return null
  }

  if (user.tipo !== 'vendedor') {
    forbidden(res, 'Somente vendedores podem usar este recurso.')
    return null
  }

  return user
}

async function getPlatformConfig() {
  let row = await selectOne(
    'configuracao_plataforma',
    'order=id.asc'
  )

  if (!row) {
    row = await insertOne(
      'configuracao_plataforma',
      {
        taxa_percentual: 5,
        atualizado_em: new Date().toISOString(),
      }
    )
  }

  return {
    id: Number(row.id),
    taxa_percentual: Number(row.taxa_percentual || 0),
    atualizado_em: row.atualizado_em || null,
  }
}

async function loadCartSnapshot(buyerId) {
  const cart = await selectOne(
    'carrinho',
    `comprador_id=eq.${encodeURIComponent(buyerId)}`
  )

  if (!cart) {
    return {
      cart: null,
      items: [],
      sellers: [],
      subtotal: 0,
    }
  }

  const rows = await supabaseRequest(
    `/item_carrinho?select=*&carrinho_id=eq.${encodeURIComponent(cart.id)}&order=id.asc`
  )

  const productIds = [
    ...new Set(
      (rows || [])
        .map(row => Number(row.produto_id))
        .filter(Boolean)
    ),
  ]

  const products = productIds.length
    ? await supabaseRequest(
        `/produto?select=*&id=in.(${productIds.join(',')})`
      )
    : []

  const productMap = new Map(
    (products || []).map(product => [
      Number(product.id),
      product,
    ])
  )

  const items = []

  for (const row of rows || []) {
    const product = productMap.get(Number(row.produto_id))

    if (!product || !product.ativo) {
      const error = new Error(
        'Um produto do carrinho não está mais disponível.'
      )
      error.status = 409
      throw error
    }

    const quantity = Number(row.quantidade)

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > Number(product.quantidade)
    ) {
      const error = new Error(
        `O estoque de "${product.nome}" mudou. Revise o carrinho.`
      )
      error.status = 409
      throw error
    }

    const unitPrice = effectivePrice(product)
    const subtotal = round2(unitPrice * quantity)

    items.push({
      cart_item_id: Number(row.id),
      product_id: Number(product.id),
      seller_id: Number(product.vendedor_id),
      quantity,
      unit_price: unitPrice,
      subtotal,
      product_name: product.nome || 'Produto',
    })
  }

  const sellers = [
    ...new Set(items.map(item => item.seller_id)),
  ]

  return {
    cart: {
      id: Number(cart.id),
      buyer_id: Number(buyerId),
    },
    items,
    sellers,
    subtotal: round2(
      items.reduce((sum, item) => sum + item.subtotal, 0)
    ),
  }
}

function normalizedItemSignature(items) {
  return (items || [])
    .map(item => ({
      product_id: Number(item.product_id ?? item.produto_id),
      quantity: Number(item.quantity ?? item.quantidade),
    }))
    .filter(
      item =>
        Number.isInteger(item.product_id) &&
        Number.isInteger(item.quantity)
    )
    .sort((a, b) => a.product_id - b.product_id)
    .map(item => `${item.product_id}:${item.quantity}`)
    .join('|')
}

async function freightAverage(req, res) {
  const seller = await requireSeller(req, res)
  if (!seller) return

  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const rows = await supabaseRequest(
    '/vendedor?select=valor_por_km&valor_por_km=gt.0&entrega_disponivel=eq.true'
  )

  const values = (rows || [])
    .map(row => Number(row.valor_por_km))
    .filter(value => Number.isFinite(value) && value > 0)

  const quantidade = values.length
  const media =
    quantidade >= 10
      ? round2(
          values.reduce((sum, value) => sum + value, 0) /
            quantidade
        )
      : null

  return ok(res, {
    media,
    quantidade,
  })
}

async function sellerProfile(req, res) {
  const user = await requireSeller(req, res)
  if (!user) return

  if (req.method !== 'PUT') {
    return methodNotAllowed(res, ['PUT'])
  }

  const body = readBody(req)
  const deliveryAvailable = Boolean(body.entrega_disponivel)
  const rawRate = body.valor_por_km
  const rate =
    rawRate === null ||
    rawRate === undefined ||
    rawRate === ''
      ? null
      : Number(rawRate)

  if (
    deliveryAvailable &&
    (!Number.isFinite(rate) || rate <= 0)
  ) {
    return badRequest(
      res,
      'Informe um valor por quilômetro maior que zero para oferecer entrega.'
    )
  }

  if (
    rate !== null &&
    (!Number.isFinite(rate) || rate <= 0)
  ) {
    return badRequest(
      res,
      'O valor por quilômetro deve ser maior que zero.'
    )
  }

  const updated = await updateOne(
    'vendedor',
    `id=eq.${encodeURIComponent(user.id)}`,
    {
      entrega_disponivel: deliveryAvailable,
      valor_por_km: deliveryAvailable ? round2(rate) : null,
    }
  )

  return ok(res, {
    seller: {
      id: Number(updated.id),
      entrega_disponivel: Boolean(updated.entrega_disponivel),
      valor_por_km:
        updated.valor_por_km == null
          ? null
          : Number(updated.valor_por_km),
    },
  })
}

async function shippingCalculate(req, res) {
  const buyer = await requireBuyer(req, res)
  if (!buyer) return

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  let buyerPoint

  try {
    buyerPoint = validateCoordinates(
      {
        lat: buyer.lat,
        lng: buyer.lng,
      },
      'Seu endereço'
    )
  } catch (error) {
    return badRequest(
      res,
      'Seu endereço ainda não possui coordenadas. Abra Meu Perfil, confira o CEP e salve o endereço novamente.'
    )
  }

  const body = readBody(req)
  const sellerIds = [
    ...new Set(
      (Array.isArray(body.vendedor_ids) ? body.vendedor_ids : [])
        .map(Number)
        .filter(id => Number.isInteger(id) && id > 0)
    ),
  ]

  if (!sellerIds.length) {
    return badRequest(res, 'Informe pelo menos um vendedor do carrinho.')
  }

  if (sellerIds.length > 20) {
    return badRequest(res, 'Há vendedores demais para um único cálculo de frete.')
  }

  const sellers = await supabaseRequest(
    `/vendedor?select=id,entrega_disponivel,valor_por_km&id=in.(${sellerIds.join(',')})`
  )

  const users = await supabaseRequest(
    `/usuario?select=id,lat,lng,cidade,uf&id=in.(${sellerIds.join(',')})`
  )

  const sellerMap = new Map(
    (sellers || []).map(row => [Number(row.id), row])
  )

  const userMap = new Map(
    (users || []).map(row => [Number(row.id), row])
  )

  const results = []

  for (const sellerId of sellerIds) {
    const seller = sellerMap.get(sellerId)
    const sellerUser = userMap.get(sellerId)

    if (!seller) {
      results.push({
        vendedor_id: sellerId,
        distancia_km: null,
        valor_frete: null,
        entrega_disponivel: false,
        aviso: 'Vendedor não encontrado.',
      })
      continue
    }

    if (
      !seller.entrega_disponivel ||
      !(Number(seller.valor_por_km) > 0)
    ) {
      results.push({
        vendedor_id: sellerId,
        distancia_km: null,
        valor_frete: null,
        entrega_disponivel: false,
        aviso: 'Este vendedor só aceita retirada em mãos.',
      })
      continue
    }

    if (
      sellerUser?.lat == null ||
      sellerUser?.lng == null
    ) {
      results.push({
        vendedor_id: sellerId,
        distancia_km: null,
        valor_frete: null,
        entrega_disponivel: true,
        aviso:
          'O endereço do vendedor ainda não possui coordenadas para calcular a entrega.',
      })
      continue
    }

    try {
      const freight = await calculateShipping({
        sellerPoint: {
          lat: sellerUser.lat,
          lng: sellerUser.lng,
        },
        buyerPoint,
        valuePerKm: seller.valor_por_km,
      })

      results.push({
        vendedor_id: sellerId,
        ...freight,
        entrega_disponivel: true,
        aviso: null,
      })
    } catch (error) {
      results.push({
        vendedor_id: sellerId,
        distancia_km: null,
        valor_frete: null,
        entrega_disponivel: true,
        aviso: error.message || 'Não foi possível calcular a entrega.',
      })
    }
  }

  return ok(res, {
    fretes: results,
  })
}

async function checkoutQuote(req, res) {
  const buyer = await requireBuyer(req, res)
  if (!buyer) return

  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const snapshot = await loadCartSnapshot(buyer.id)
  const config = await getPlatformConfig()
  const serviceFee = round2(
    snapshot.subtotal * (config.taxa_percentual / 100)
  )

  return ok(res, {
    subtotal_produtos: snapshot.subtotal,
    taxa_percentual: config.taxa_percentual,
    taxa_servico: serviceFee,
    taxa_cobrada_do_comprador: false,
    vendedores: snapshot.sellers,
  })
}

async function checkoutCreate(req, res) {
  const buyer = await requireBuyer(req, res)
  if (!buyer) return

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  try {
    validateCoordinates(
      { lat: buyer.lat, lng: buyer.lng },
      'Seu endereço'
    )
  } catch {
    return badRequest(
      res,
      'Seu endereço ainda não possui coordenadas. Abra Meu Perfil, confira o CEP e salve o endereço novamente antes de finalizar.'
    )
  }

  const body = readBody(req)
  const paymentMethod = clean(
    body.payment_method ?? body.metodo_pagamento
  ).toLowerCase()

  if (!['pix', 'cartao'].includes(paymentMethod)) {
    return badRequest(
      res,
      'Escolha Pix ou Cartão de Crédito.'
    )
  }

  const snapshot = await loadCartSnapshot(buyer.id)

  if (!snapshot.items.length) {
    return badRequest(res, 'Seu carrinho está vazio.')
  }

  const sentItems = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.itens)
      ? body.itens
      : []

  if (!sentItems.length) {
    return badRequest(
      res,
      'Os itens do checkout não foram informados.'
    )
  }

  if (
    normalizedItemSignature(sentItems) !==
    normalizedItemSignature(snapshot.items)
  ) {
    return res.status(409).json({
      error:
        'O carrinho mudou desde que o checkout foi aberto. Atualize a página e confira os itens novamente.',
    })
  }

  const rawMethods = Array.isArray(body.delivery_methods)
    ? body.delivery_methods
    : Array.isArray(body.entregas)
      ? body.entregas
      : []

  const methods = rawMethods.map(item => ({
    vendedor_id: Number(item.vendedor_id),
    tipo_frete: clean(item.tipo_frete ?? item.tipo).toLowerCase(),
  }))

  const sellerSet = new Set(snapshot.sellers)
  const methodMap = new Map()

  for (const method of methods) {
    if (
      !sellerSet.has(method.vendedor_id) ||
      !['retirada', 'entrega'].includes(method.tipo_frete) ||
      methodMap.has(method.vendedor_id)
    ) {
      return badRequest(
        res,
        'As opções de entrega do checkout são inválidas.'
      )
    }

    methodMap.set(method.vendedor_id, method.tipo_frete)
  }

  if (methodMap.size !== snapshot.sellers.length) {
    return badRequest(
      res,
      'Escolha retirada ou entrega para cada vendedor.'
    )
  }

  const sellers = await supabaseRequest(
    `/vendedor?select=id,entrega_disponivel,valor_por_km&id=in.(${snapshot.sellers.join(',')})`
  )

  const sellerUsers = await supabaseRequest(
    `/usuario?select=id,lat,lng&id=in.(${snapshot.sellers.join(',')})`
  )

  const sellerMap = new Map(
    (sellers || []).map(row => [Number(row.id), row])
  )
  const sellerUserMap = new Map(
    (sellerUsers || []).map(row => [Number(row.id), row])
  )

  const rpcDeliveries = []
  let freightTotal = 0

  for (const sellerId of snapshot.sellers) {
    const type = methodMap.get(sellerId)
    const seller = sellerMap.get(sellerId)
    const sellerUser = sellerUserMap.get(sellerId)

    if (!seller) {
      return badRequest(res, 'Um vendedor do carrinho não existe mais.')
    }

    if (type === 'retirada') {
      rpcDeliveries.push({
        vendedor_id: sellerId,
        tipo_frete: 'retirada',
        distancia_km: null,
      })
      continue
    }

    if (
      !seller.entrega_disponivel ||
      !(Number(seller.valor_por_km) > 0)
    ) {
      return badRequest(
        res,
        'Um dos vendedores selecionados não oferece mais entrega.'
      )
    }

    if (
      sellerUser?.lat == null ||
      sellerUser?.lng == null
    ) {
      return badRequest(
        res,
        'Um dos vendedores ainda não possui coordenadas para entrega. Escolha retirada em mãos.'
      )
    }

    const freight = await calculateShipping({
      sellerPoint: {
        lat: sellerUser.lat,
        lng: sellerUser.lng,
      },
      buyerPoint: {
        lat: buyer.lat,
        lng: buyer.lng,
      },
      valuePerKm: seller.valor_por_km,
    })

    freightTotal = round2(freightTotal + freight.valor_frete)

    rpcDeliveries.push({
      vendedor_id: sellerId,
      tipo_frete: 'entrega',
      distancia_km: freight.distancia_km,
    })
  }

  const provider = new MockPaymentProvider()
  const expectedTotal = round2(snapshot.subtotal + freightTotal)
  const payment = await provider.createPayment(
    {
      id: null,
      comprador_id: Number(buyer.id),
      metodo: paymentMethod,
    },
    expectedTotal
  )

  const rpcItems = snapshot.items.map(item => ({
    produto_id: item.product_id,
    quantidade: item.quantity,
  }))

  const result = await supabaseRpc(
    'criar_pedido_atomico',
    {
      p_comprador_id: Number(buyer.id),
      p_itens: rpcItems,
      p_entregas: rpcDeliveries,
      p_forma_pagamento: paymentMethod,
      p_gateway_id: payment.gateway_id,
      p_link_pagamento: payment.link_pagamento,
    }
  )

  const order = Array.isArray(result) ? result[0] : result

  return ok(res, {
    order,
    payment: {
      gateway_id: payment.gateway_id,
      status: payment.status,
      link_pagamento: payment.link_pagamento,
    },
  })
}

async function mockConfirm(req, res) {
  const buyer = await requireBuyer(req, res)
  if (!buyer) return

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const body = readBody(req)
  const orderId = Number(body.pedido_id)
  const gatewayId = clean(body.gateway_id)

  if (!Number.isInteger(orderId) || orderId <= 0 || !gatewayId) {
    return badRequest(res, 'Pedido ou pagamento inválido.')
  }

  const order = await selectOne(
    'pedido',
    `id=eq.${encodeURIComponent(orderId)}&comprador_id=eq.${encodeURIComponent(buyer.id)}`
  )

  if (!order) {
    return notFound(res, 'Pedido não encontrado.')
  }

  const payment = await selectOne(
    'pagamento',
    `pedido_id=eq.${encodeURIComponent(orderId)}`
  )

  if (!payment || String(payment.gateway_id || '') !== gatewayId) {
    return forbidden(res, 'Este pagamento não pertence ao pedido informado.')
  }

  const provider = new MockPaymentProvider()
  const processed = await provider.processPayment(gatewayId)

  if (processed.status !== 'aprovado') {
    return badRequest(res, 'O pagamento simulado não foi aprovado.')
  }

  const result = await supabaseRpc(
    'confirmar_pagamento_mock',
    {
      p_pedido_id: orderId,
      p_comprador_id: Number(buyer.id),
      p_gateway_id: gatewayId,
    }
  )

  return ok(res, {
    payment: Array.isArray(result) ? result[0] : result,
  })
}

async function adminConfig(req, res) {
  const actor = await resolveAdmin(req)

  if (!actor.user) {
    return unauthorized(res)
  }

  if (!actor.allowed) {
    return forbidden(res, 'Apenas ADM ou CEO pode acessar esta configuração.')
  }

  if (req.method === 'GET') {
    const config = await getPlatformConfig()

    return ok(res, {
      ...config,
      editable: actor.level === 'ceo',
      viewer_level: actor.level,
    })
  }

  if (req.method === 'PUT') {
    if (actor.level !== 'ceo') {
      return forbidden(
        res,
        'Apenas o CEO pode alterar a taxa da plataforma.'
      )
    }

    const body = readBody(req)
    const rate = Number(body.taxa_percentual)

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return badRequest(
        res,
        'A taxa percentual deve estar entre 0 e 100.'
      )
    }

    const current = await getPlatformConfig()
    const updated = await updateOne(
      'configuracao_plataforma',
      `id=eq.${encodeURIComponent(current.id)}`,
      {
        taxa_percentual: round2(rate),
        atualizado_em: new Date().toISOString(),
      }
    )

    return ok(res, {
      id: Number(updated.id),
      taxa_percentual: Number(updated.taxa_percentual),
      atualizado_em: updated.atualizado_em,
      editable: true,
      viewer_level: actor.level,
    })
  }

  return methodNotAllowed(res, ['GET', 'PUT'])
}

export default async function handler(req, res) {
  try {
    const resource = clean(req.query?.resource).toLowerCase()

    if (resource === 'freight_average') {
      return freightAverage(req, res)
    }

    if (resource === 'seller_profile') {
      return sellerProfile(req, res)
    }

    if (resource === 'shipping_calculate') {
      return shippingCalculate(req, res)
    }

    if (resource === 'checkout') {
      return req.method === 'GET'
        ? checkoutQuote(req, res)
        : checkoutCreate(req, res)
    }

    if (resource === 'mock_confirm') {
      return mockConfirm(req, res)
    }

    if (resource === 'admin_config') {
      return adminConfig(req, res)
    }

    return notFound(res, 'Recurso não encontrado.')
  } catch (error) {
    return serverError(res, error)
  }
}
