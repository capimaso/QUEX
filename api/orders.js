import { firstPhotoUrl } from './_lib/photos.js'
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
  created,
  forbidden,
  json,
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

const statusLabels = {
  aguardando_pagamento: 'Aguardando pagamento',
  pendente: 'Pendente',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  enviado: 'Enviado',
  despachado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const round2 = value =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100

async function buildOrders(orders, viewer = null) {
  if (!orders?.length) return []

  const orderIds = orders.map(order => Number(order.id))

  const items = await supabaseRequest(
    `/pedido_item?select=*&pedido_id=in.(${orderIds.join(',')})&order=id.asc`
  )

  const productIds = [
    ...new Set(
      (items || [])
        .map(item => Number(item.produto_id))
        .filter(Boolean)
    ),
  ]

  const products = productIds.length
    ? await supabaseRequest(
        `/produto?select=id,vendedor_id,nome,fotos_url,unidade&id=in.(${productIds.join(',')})`
      )
    : []

  const productMap = new Map(
    (products || []).map(product => [
      Number(product.id),
      product,
    ])
  )

  const buyerIds = [
    ...new Set(
      orders
        .map(order => Number(order.comprador_id))
        .filter(Boolean)
    ),
  ]

  const buyerUsers = buyerIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome,email,telefone&id=in.(${buyerIds.join(',')})`
      )
    : []

  const buyerMap = new Map(
    (buyerUsers || []).map(user => [
      Number(user.id),
      user,
    ])
  )

  const deliveries = await supabaseRequest(
    `/entrega?select=*&pedido_id=in.(${orderIds.join(',')})&order=id.asc`
  )

  const sellerIds = [
    ...new Set(
      [
        ...(deliveries || []).map(row => Number(row.vendedor_id)),
        ...(products || []).map(row => Number(row.vendedor_id)),
      ].filter(Boolean)
    ),
  ]

  const sellerUsers = sellerIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome&id=in.(${sellerIds.join(',')})`
      )
    : []

  const sellerShops = sellerIds.length
    ? await supabaseRequest(
        `/vendedor?select=id,comercial&id=in.(${sellerIds.join(',')})`
      )
    : []

  const sellerNames = new Map(
    (sellerUsers || []).map(user => [
      Number(user.id),
      user.nome,
    ])
  )

  for (const shop of sellerShops || []) {
    if (shop.comercial) {
      sellerNames.set(Number(shop.id), shop.comercial)
    }
  }

  const revenues = await supabaseRequest(
    `/receita_plataforma?select=*&pedido_id=in.(${orderIds.join(',')})`
  )

  const payments = await supabaseRequest(
    `/pagamento?select=*&pedido_id=in.(${orderIds.join(',')})`
  )

  const paymentMap = new Map(
    (payments || []).map(payment => [
      Number(payment.pedido_id),
      payment,
    ])
  )

  const deliveriesByOrder = new Map()

  for (const delivery of deliveries || []) {
    const orderId = Number(delivery.pedido_id)

    if (!deliveriesByOrder.has(orderId)) {
      deliveriesByOrder.set(orderId, [])
    }

    deliveriesByOrder.get(orderId).push({
      id: Number(delivery.id),
      seller_id: Number(delivery.vendedor_id),
      seller_name:
        sellerNames.get(Number(delivery.vendedor_id)) || 'Vendedor',
      type: delivery.tipo_frete || 'entrega',
      shipping_value: Number(delivery.valor_frete || 0),
      distance_km:
        delivery.distancia_km == null
          ? null
          : Number(delivery.distancia_km),
      address: delivery.endereco_destino || '',
      scheduled_at: delivery.data_agendada,
      tracking_code: delivery.codigo_rastreio || '',
      status: delivery.status,
      via_food: Boolean(delivery.via_food),
    })
  }

  const revenueByOrderSeller = new Map()

  for (const row of revenues || []) {
    revenueByOrderSeller.set(
      `${Number(row.pedido_id)}:${Number(row.vendedor_id)}`,
      {
        id: Number(row.id),
        seller_id: Number(row.vendedor_id),
        product_value: Number(row.valor_produto || 0),
        platform_fee: Number(row.valor_taxa || 0),
        percentage: Number(row.percentual_aplicado || 0),
        net_value: round2(
          Number(row.valor_produto || 0) -
            Number(row.valor_taxa || 0)
        ),
      }
    )
  }

  const itemMap = new Map()

  for (const item of items || []) {
    const product = productMap.get(Number(item.produto_id))

    if (!itemMap.has(Number(item.pedido_id))) {
      itemMap.set(Number(item.pedido_id), [])
    }

    itemMap.get(Number(item.pedido_id)).push({
      id: Number(item.id),
      product_id: Number(item.produto_id),
      seller_id: Number(product?.vendedor_id || 0),
      seller_name:
        sellerNames.get(Number(product?.vendedor_id)) || 'Vendedor',
      product_name: product?.nome || 'Produto',
      image_url: firstPhotoUrl(product?.fotos_url),
      unit: product?.unidade || 'kg',
      quantity: Number(item.quantidade),
      unit_price: Number(item.preco_unitario || 0),
      subtotal: Number(item.subtotal || 0),
    })
  }

  const myReviews = new Map()

  if (viewer) {
    const rows = await supabaseRequest(
      `/avaliacao?select=pedido_id,avaliado_id,nota&avaliador_id=eq.${encodeURIComponent(viewer.id)}&pedido_id=in.(${orderIds.join(',')})`
    )

    for (const review of rows || []) {
      myReviews.set(
        `${Number(review.pedido_id)}:${Number(review.avaliado_id)}`,
        Number(review.nota)
      )
    }
  }

  return orders.map(order => {
    const orderId = Number(order.id)
    const orderItems = itemMap.get(orderId) || []
    const orderDeliveries = deliveriesByOrder.get(orderId) || []
    const buyer = buyerMap.get(Number(order.comprador_id))
    const sellerList = [
      ...new Set(
        orderItems
          .map(item => Number(item.seller_id))
          .filter(Boolean)
      ),
    ].map(id => ({
      id,
      name: sellerNames.get(id) || 'Vendedor',
    }))

    const viewerIsBuyer =
      Boolean(viewer) &&
      Number(order.comprador_id) === Number(viewer.id)

    const viewerIsSeller =
      Boolean(viewer) &&
      sellerList.some(seller => seller.id === Number(viewer.id))

    const counterpart = viewerIsBuyer
      ? sellerList[0]
        ? {
            id: sellerList[0].id,
            name: sellerList[0].name,
            role: 'seller',
          }
        : null
      : viewerIsSeller
        ? {
            id: Number(order.comprador_id),
            name: buyer?.nome || 'Comprador',
            role: 'buyer',
          }
        : null

    const reviewKey = counterpart
      ? `${orderId}:${counterpart.id}`
      : null

    const mine =
      reviewKey && myReviews.has(reviewKey)
        ? myReviews.get(reviewKey)
        : undefined

    const myDelivery = viewerIsSeller
      ? orderDeliveries.find(
          delivery => delivery.seller_id === Number(viewer.id)
        ) || null
      : null

    const sellerFinancial = viewerIsSeller
      ? revenueByOrderSeller.get(
          `${orderId}:${Number(viewer.id)}`
        ) || null
      : null

    const productsSubtotal =
      order.subtotal_produtos == null
        ? round2(
            orderItems.reduce(
              (sum, item) => sum + Number(item.subtotal || 0),
              0
            )
          )
        : Number(order.subtotal_produtos)

    const freightTotal =
      order.valor_frete == null
        ? round2(
            orderDeliveries.reduce(
              (sum, delivery) =>
                sum + Number(delivery.shipping_value || 0),
              0
            )
          )
        : Number(order.valor_frete)

    const payment = paymentMap.get(orderId)

    return {
      id: orderId,
      buyer_id: Number(order.comprador_id),
      buyer_name: buyer?.nome || 'Comprador',
      buyer_email: viewerIsSeller ? buyer?.email || '' : '',
      buyer_phone: viewerIsSeller ? buyer?.telefone || '' : '',
      status: order.status,
      status_label: statusLabels[order.status] || order.status,
      created_at: order.data_criacao,
      subtotal_products: productsSubtotal,
      shipping_total: freightTotal,
      total: Number(order.valor_total || 0),
      items: orderItems,
      sellers: sellerList,
      deliveries: orderDeliveries,
      my_delivery: myDelivery,
      seller_financial: sellerFinancial,
      seller_status: myDelivery?.status || order.status,
      seller_status_label:
        statusLabels[myDelivery?.status || order.status] ||
        myDelivery?.status ||
        order.status,
      delivery_address:
        myDelivery?.address ||
        orderDeliveries.find(delivery => delivery.type === 'entrega')
          ?.address ||
        '',
      tracking_code:
        myDelivery?.tracking_code ||
        orderDeliveries.find(delivery => delivery.tracking_code)
          ?.tracking_code ||
        '',
      payment: payment
        ? {
            id: Number(payment.id),
            method: payment.forma_pagamento,
            status: payment.status,
            value: Number(payment.valor || 0),
            gateway_id: payment.gateway_id || '',
            payment_link: payment.link_pagamento || '',
            approved_at:
              payment.data_aprovacao ||
              payment.data_pagamento ||
              null,
          }
        : null,
      counterpart,
      can_review:
        Boolean(counterpart) &&
        order.status === 'entregue' &&
        mine === undefined,
      my_review:
        mine === undefined
          ? null
          : { rating: mine },
    }
  })
}

async function createReview(req, res, user) {
  const body =
    req.body && typeof req.body === 'object'
      ? req.body
      : {}

  const orderId = Number(body.order_id)
  const raw = body.rating
  const rating =
    typeof raw === 'number'
      ? raw
      : /^\d+$/.test(String(raw ?? ''))
        ? Number(raw)
        : NaN
  const comment = String(body.comment ?? '').trim()

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return badRequest(res, 'Pedido inválido.')
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return badRequest(res, 'Escolha uma nota de 1 a 5 estrelas.')
  }

  if (comment.length > 500) {
    return badRequest(
      res,
      'O comentário pode ter no máximo 500 caracteres.'
    )
  }

  const order = await selectOne(
    'pedido',
    `id=eq.${encodeURIComponent(orderId)}`
  )

  if (!order) {
    return notFound(res, 'Pedido não encontrado.')
  }

  if (order.status !== 'entregue') {
    return badRequest(
      res,
      'Só dá pra avaliar depois que o pedido for entregue.'
    )
  }

  const deliveries = await supabaseRequest(
    `/entrega?select=vendedor_id&pedido_id=eq.${encodeURIComponent(orderId)}`
  )

  const sellerIds = (deliveries || []).map(row =>
    Number(row.vendedor_id)
  )

  const buyerId = Number(order.comprador_id)
  const me = Number(user.id)
  let evaluatedId

  if (me === buyerId) {
    const requestedSeller = Number(body.seller_id)

    evaluatedId =
      Number.isInteger(requestedSeller) &&
      sellerIds.includes(requestedSeller)
        ? requestedSeller
        : sellerIds[0]

    if (!evaluatedId) {
      return badRequest(res, 'O pedido não possui vendedor para avaliar.')
    }
  } else if (sellerIds.includes(me)) {
    evaluatedId = buyerId
  } else {
    return forbidden(res, 'Você não participou deste pedido.')
  }

  const already = await selectOne(
    'avaliacao',
    `pedido_id=eq.${encodeURIComponent(orderId)}&avaliador_id=eq.${encodeURIComponent(me)}&avaliado_id=eq.${encodeURIComponent(evaluatedId)}`
  )

  if (already) {
    return json(res, 409, {
      error: 'Você já avaliou esta pessoa neste pedido.',
    })
  }

  try {
    await insertOne('avaliacao', {
      pedido_id: orderId,
      avaliador_id: me,
      avaliado_id: evaluatedId,
      nota: rating,
      comentario: comment || null,
    })
  } catch (error) {
    if (error.status === 409) {
      return json(res, 409, {
        error: 'Você já avaliou esta pessoa neste pedido.',
      })
    }

    if (error.status === 400) {
      return badRequest(res, error.message)
    }

    throw error
  }

  return created(res, {
    review: {
      order_id: orderId,
      evaluated_id: evaluatedId,
      rating,
    },
  })
}

async function recalculateAggregateOrderStatus(orderId) {
  const deliveries = await supabaseRequest(
    `/entrega?select=status&pedido_id=eq.${encodeURIComponent(orderId)}`
  )

  const statuses = (deliveries || []).map(row => row.status)

  if (!statuses.length) return null

  let nextStatus

  if (statuses.every(status => status === 'entregue')) {
    nextStatus = 'entregue'
  } else if (
    statuses.some(status =>
      ['enviado', 'despachado'].includes(status)
    )
  ) {
    nextStatus = 'enviado'
  } else if (
    statuses.some(status => status === 'em_preparo')
  ) {
    nextStatus = 'em_preparo'
  } else if (
    statuses.every(status => status === 'aguardando_pagamento')
  ) {
    nextStatus = 'aguardando_pagamento'
  } else {
    return null
  }

  await updateOne(
    'pedido',
    `id=eq.${encodeURIComponent(orderId)}`,
    { status: nextStatus }
  )

  return nextStatus
}

async function updateSellerOrder(req, res, user) {
  const orderId = Number(req.query?.id)
  const nextStatus = String(req.body?.status || '').trim().toLowerCase()
  const tracking = String(req.body?.tracking_code || '').trim()

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return badRequest(res, 'ID do pedido inválido.')
  }

  const delivery = await selectOne(
    'entrega',
    `pedido_id=eq.${encodeURIComponent(orderId)}&vendedor_id=eq.${encodeURIComponent(user.id)}`
  )

  if (!delivery) {
    return forbidden(
      res,
      'Este pedido não possui uma entrega vinculada à sua loja.'
    )
  }

  const current = delivery.status
  const deliveryType = delivery.tipo_frete || 'entrega'

  const allowed = {
    pago: ['em_preparo'],
    em_preparo:
      deliveryType === 'retirada'
        ? ['entregue']
        : ['enviado'],
    enviado: ['entregue'],
    despachado: ['entregue'],
  }

  if (!(allowed[current] || []).includes(nextStatus)) {
    return badRequest(
      res,
      `Não é possível mudar de ${
        statusLabels[current] || current
      } para ${statusLabels[nextStatus] || nextStatus}.`
    )
  }

  if (tracking.length > 100) {
    return badRequest(
      res,
      'O código de rastreio pode ter no máximo 100 caracteres.'
    )
  }

  const patch = {
    status: nextStatus,
  }

  if (nextStatus === 'enviado' && tracking) {
    patch.codigo_rastreio = tracking
  }

  await updateOne(
    'entrega',
    `id=eq.${encodeURIComponent(delivery.id)}&vendedor_id=eq.${encodeURIComponent(user.id)}`,
    patch
  )

  await recalculateAggregateOrderStatus(orderId)

  const freshOrder = await selectOne(
    'pedido',
    `id=eq.${encodeURIComponent(orderId)}`
  )

  const enriched = await buildOrders([freshOrder], user)

  return ok(res, {
    order: enriched[0],
  })
}

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

    // Rotas consolidadas do Módulo 11.
    // Continuam dentro de api/orders.js para respeitar o limite do Vercel Hobby.
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

    const user = await requireUser(req)

    if (!user) return unauthorized(res)

    if (
      req.method === 'POST' &&
      resource === 'review'
    ) {
      return createReview(req, res, user)
    }

    if (req.method === 'GET') {
      const requestedId = Number(req.query?.id)
      let rows

      if (Number.isInteger(requestedId) && requestedId > 0) {
        const row = await selectOne(
          'pedido',
          `id=eq.${encodeURIComponent(requestedId)}`
        )

        rows = row ? [row] : []
      } else {
        rows = await supabaseRequest(
          '/pedido?select=*&order=id.desc'
        )
      }

      if (user.tipo === 'comprador') {
        rows = (rows || []).filter(
          order => Number(order.comprador_id) === Number(user.id)
        )
      }

      let enriched = await buildOrders(rows || [], user)

      if (user.tipo === 'vendedor') {
        enriched = enriched.filter(order =>
          order.sellers.some(
            seller => seller.id === Number(user.id)
          )
        )
      }

      if (Number.isInteger(requestedId) && requestedId > 0) {
        if (!enriched[0]) {
          return notFound(
            res,
            'Pedido não encontrado ou não pertence à sua conta.'
          )
        }

        return ok(res, {
          order: enriched[0],
        })
      }

      return ok(res, {
        orders: enriched,
      })
    }

    if (req.method === 'PATCH') {
      if (user.tipo !== 'vendedor') {
        return forbidden(
          res,
          'Somente vendedores podem atualizar pedidos.'
        )
      }

      return updateSellerOrder(req, res, user)
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
  } catch (error) {
    return serverError(res, error)
  }
}
