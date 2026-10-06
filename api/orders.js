import { firstPhotoUrl } from './_lib/photos.js'
import {
  supabaseRequest,
  selectOne,
  insertOne,
  updateOne,
} from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import {
  badRequest,
  created,
  forbidden,
  json,
  notFound,
  ok,
  serverError,
  unauthorized,
} from './_lib/http.js'

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

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)

    if (!user) return unauthorized(res)

    if (
      req.method === 'POST' &&
      req.query?.resource === 'review'
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

    return res.status(405).json({
      error: 'Método não permitido.',
    })
  } catch (error) {
    return serverError(res, error)
  }
}
