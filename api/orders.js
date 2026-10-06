import { firstPhotoUrl } from './_lib/photos.js'
import {
  supabaseRequest,
  supabaseRpc,
  selectOne,
  insertOne,
  updateOne,
} from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { badRequest, created, forbidden, json, notFound, ok, serverError, unauthorized } from './_lib/http.js'

const statusLabels = {
  pendente: 'Pendente',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  despachado: 'Despachado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

async function buildOrders(orders, viewer = null) {
  if (!orders?.length) return []
  const orderIds = orders.map(o => Number(o.id))
  const items = await supabaseRequest(`/pedido_item?select=*&pedido_id=in.(${orderIds.join(',')})&order=id.asc`)
  const productIds = [...new Set((items || []).map(i => Number(i.produto_id)))]
  const products = productIds.length ? await supabaseRequest(`/produto?select=id,vendedor_id,nome,preco,fotos_url,unidade&id=in.(${productIds.join(',')})`) : []
  const productMap = new Map((products || []).map(p => [Number(p.id), p]))

  const buyerIds = [...new Set(orders.map(o => Number(o.comprador_id)).filter(Boolean))]
  const buyers = buyerIds.length ? await supabaseRequest(`/comprador?select=id,cpf&id=in.(${buyerIds.join(',')})`) : []
  const buyerUsers = buyerIds.length ? await supabaseRequest(`/usuario?select=id,nome,email,telefone&id=in.(${buyerIds.join(',')})`) : []
  const buyerMap = new Map((buyerUsers || []).map(u => [Number(u.id), u]))

  const deliveries = await supabaseRequest(`/entrega?select=*&pedido_id=in.(${orderIds.join(',')})`)
  const deliveryMap = new Map((deliveries || []).map(d => [Number(d.pedido_id), d]))

  // nome do vendedor de cada pedido (loja, ou nome da pessoa se não tiver loja)
  const sellerIds = [...new Set((deliveries || []).map(d => Number(d.vendedor_id)).filter(Boolean))]
  const sellerUsers = sellerIds.length ? await supabaseRequest(`/usuario?select=id,nome&id=in.(${sellerIds.join(',')})`) : []
  const sellerShops = sellerIds.length ? await supabaseRequest(`/vendedor?select=id,comercial&id=in.(${sellerIds.join(',')})`) : []
  const sellerNames = new Map((sellerUsers || []).map(u => [Number(u.id), u.nome]))
  for (const shop of sellerShops || []) if (shop.comercial) sellerNames.set(Number(shop.id), shop.comercial)

  // SÓ as avaliações que o próprio usuário fez. Nunca devolvemos avaliações recebidas nem quem avaliou.
  const myReviews = new Map()
  if (viewer) {
    const rows = await supabaseRequest(`/avaliacao?select=pedido_id,nota&avaliador_id=eq.${encodeURIComponent(viewer.id)}&pedido_id=in.(${orderIds.join(',')})`)
    for (const r of rows || []) myReviews.set(Number(r.pedido_id), Number(r.nota))
  }

  const itemMap = new Map()
  for (const item of items || []) {
    const product = productMap.get(Number(item.produto_id))
    if (!itemMap.has(Number(item.pedido_id))) itemMap.set(Number(item.pedido_id), [])
    itemMap.get(Number(item.pedido_id)).push({
      id: Number(item.id),
      product_id: Number(item.produto_id),
      seller_id: Number(product?.vendedor_id || 0),
      product_name: product?.nome || 'Produto',
      image_url: firstPhotoUrl(product?.fotos_url),
      unit: product?.unidade || 'kg',
      quantity: Number(item.quantidade),
      unit_price: Number(item.preco_unitario || 0),
      subtotal: Number(item.subtotal || 0),
    })
  }

  return orders.map(order => {
    const delivery = deliveryMap.get(Number(order.id))
    const buyer = buyerMap.get(Number(order.comprador_id))
    const sellerId = delivery ? Number(delivery.vendedor_id) : null
    const viewerIsBuyer = Boolean(viewer) && Number(order.comprador_id) === Number(viewer.id)
    const viewerIsSeller = Boolean(viewer) && sellerId !== null && sellerId === Number(viewer.id)
    const mine = myReviews.get(Number(order.id))
    const counterpart = viewerIsBuyer
      ? { id: sellerId, name: sellerNames.get(sellerId) || 'Vendedor', role: 'seller' }
      : viewerIsSeller ? { id: Number(order.comprador_id), name: buyer?.nome || 'Comprador', role: 'buyer' } : null
    return {
      seller_id: sellerId,
      seller_name: sellerId ? sellerNames.get(sellerId) || 'Vendedor' : '',
      counterpart,
      can_review: Boolean(counterpart) && order.status === 'entregue' && mine === undefined,
      my_review: mine === undefined ? null : { rating: mine },
      id: Number(order.id),
      buyer_id: Number(order.comprador_id),
      buyer_name: buyer?.nome || 'Comprador',
      buyer_email: buyer?.email || '',
      buyer_phone: buyer?.telefone || '',
      status: order.status,
      status_label: statusLabels[order.status] || order.status,
      created_at: order.data_criacao,
      total: Number(order.valor_total || 0),
      items: itemMap.get(Number(order.id)) || [],
      delivery: delivery ? {
        id: Number(delivery.id),
        seller_id: Number(delivery.vendedor_id),
        address: delivery.endereco_destino,
        scheduled_at: delivery.data_agendada,
        tracking_code: delivery.codigo_rastreio,
        status: delivery.status,
        via_food: Boolean(delivery.via_food),
      } : null,
      delivery_address: delivery?.endereco_destino || '',
      tracking_code: delivery?.codigo_rastreio || '',
    }
  })
}

// POST /api/orders?resource=review   { order_id, rating (1-5), comment? }
// Comprador avalia o vendedor e vendedor avalia o comprador, só depois de ENTREGUE, uma vez por pedido.
// As mesmas regras também existem no banco (trigger quex_validar_avaliacao): aqui só damos mensagens amigáveis.
async function createCheckout(req, res, user) {
  if (user.tipo !== 'comprador') {
    return forbidden(
      res,
      'Somente compradores podem finalizar pedidos.'
    )
  }

  const address = String(
    req.body?.address || ''
  ).trim()

  const paymentMethod = String(
    req.body?.payment_method || 'pix'
  )
    .trim()
    .toLowerCase()

  if (address.length < 8) {
    return badRequest(
      res,
      'Informe um endereço de entrega completo.'
    )
  }

  if (
    ![
      'pix',
      'cartao',
      'dinheiro',
    ].includes(paymentMethod)
  ) {
    return badRequest(
      res,
      'Forma de pagamento inválida.'
    )
  }

  try {
    const result = await supabaseRpc(
      'quex_finalizar_checkout',
      {
        p_comprador_id: Number(user.id),
        p_endereco_destino: address,
        p_forma_pagamento: paymentMethod,
      }
    )

    return ok(res, {
      order: Array.isArray(result)
        ? result[0]
        : result,
    })
  } catch (error) {
    const message = String(
      error.message || ''
    )

    if (
      message.includes(
        'quex_finalizar_checkout'
      )
    ) {
      return serverError(
        res,
        new Error(
          'A função de checkout ainda não foi instalada no Supabase. Execute supabase/app.sql uma vez no SQL Editor.'
        )
      )
    }

    throw error
  }
}

async function createReview(req, res, user) {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const orderId = Number(body.order_id)
  const raw = body.rating
  const rating = typeof raw === 'number' ? raw : /^\d+$/.test(String(raw ?? '')) ? Number(raw) : NaN
  const comment = String(body.comment ?? '').trim()
  if (!Number.isInteger(orderId) || orderId <= 0) return badRequest(res, 'Pedido inválido.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return badRequest(res, 'Escolha uma nota de 1 a 5 estrelas.')
  if (comment.length > 500) return badRequest(res, 'O comentário pode ter no máximo 500 caracteres.')

  const order = await selectOne('pedido', `id=eq.${encodeURIComponent(orderId)}`)
  const delivery = order ? await selectOne('entrega', `pedido_id=eq.${encodeURIComponent(orderId)}`) : null
  if (!order || !delivery) return notFound(res, 'Pedido não encontrado.')

  const buyerId = Number(order.comprador_id)
  const sellerId = Number(delivery.vendedor_id)
  const me = Number(user.id)
  if (me !== buyerId && me !== sellerId) return forbidden(res, 'Você não participou deste pedido.')
  if (order.status !== 'entregue') return badRequest(res, 'Só dá pra avaliar depois que o pedido for entregue.')

  const already = await selectOne('avaliacao', `pedido_id=eq.${encodeURIComponent(orderId)}&avaliador_id=eq.${encodeURIComponent(me)}`)
  if (already) return json(res, 409, { error: 'Você já avaliou este pedido.' })

  try {
    await insertOne('avaliacao', {
      pedido_id: orderId,
      avaliador_id: me,
      avaliado_id: me === buyerId ? sellerId : buyerId,
      nota: rating,
      comentario: comment || null,
    })
  } catch (error) {
    if (error.status === 409) return json(res, 409, { error: 'Você já avaliou este pedido.' }) // duas requisições ao mesmo tempo
    if (error.status === 400) return badRequest(res, error.message)
    throw error
  }
  return created(res, { review: { order_id: orderId, rating } })
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    
    if (
      req.method === 'POST' &&
      req.query?.resource === 'checkout'
    ) {
      return createCheckout(
        req,
        res,
        user
      )
    }
    
    if (req.method === 'POST' && req.query?.resource === 'review') return createReview(req, res, user)

    if (req.method === 'GET') {
      const all = await supabaseRequest(`/pedido?select=*&order=id.desc`)
      const orders = user.tipo === 'comprador'
        ? (all || []).filter(o => Number(o.comprador_id) === Number(user.id))
        : all || []
      const enriched = await buildOrders(orders, user)
      if (user.tipo === 'vendedor') {
        return ok(res, { orders: enriched.filter(order => order.items.some(item => item.seller_id === Number(user.id))) })
      }
      return ok(res, { orders: enriched })
    }

    if (req.method === 'PATCH') {
      if (user.tipo !== 'vendedor') return forbidden(res, 'Somente vendedores podem atualizar pedidos.')
      const orderId = Number(req.query?.id)
      const nextStatus = String(req.body?.status || '')
      if (!Number.isInteger(orderId)) return badRequest(res, 'ID do pedido inválido.')
      const allowed = ['em_preparo', 'despachado', 'entregue', 'cancelado']
      if (!allowed.includes(nextStatus)) return badRequest(res, 'Status inválido.')

      const order = await selectOne('pedido', `id=eq.${encodeURIComponent(orderId)}`)
      if (!order) return notFound(res, 'Pedido não encontrado.')
      const items = await supabaseRequest(`/pedido_item?select=produto_id&pedido_id=eq.${encodeURIComponent(orderId)}`)
      const productIds = [...new Set((items || []).map(i => Number(i.produto_id)))]
      const products = productIds.length ? await supabaseRequest(`/produto?select=id,vendedor_id&id=in.(${productIds.join(',')})`) : []
      const ownsItem = (products || []).some(p => Number(p.vendedor_id) === Number(user.id))
      if (!ownsItem) return forbidden(res, 'Este pedido não contém produtos da sua loja.')

      const transitions = {
        pendente: ['em_preparo', 'cancelado'],
        pago: ['em_preparo', 'cancelado'],
        em_preparo: ['despachado', 'cancelado'],
        despachado: ['entregue'],
        entregue: [],
        cancelado: [],
      }
      if (!(transitions[order.status] || []).includes(nextStatus)) return badRequest(res, `Não é possível mudar de ${statusLabels[order.status] || order.status} para ${statusLabels[nextStatus]}.`)

      await updateOne('pedido', `id=eq.${encodeURIComponent(orderId)}`, { status: nextStatus })
      const delivery = await selectOne('entrega', `pedido_id=eq.${encodeURIComponent(orderId)}`)
      if (delivery) {
        const patch = { status: nextStatus }
        if (nextStatus === 'despachado' && !delivery.codigo_rastreio) patch.codigo_rastreio = `QX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        if (nextStatus === 'entregue') patch.status = 'entregue'
        await updateOne('entrega', `id=eq.${encodeURIComponent(delivery.id)}`, patch)
      }
      const fresh = await buildOrders([await selectOne('pedido', `id=eq.${encodeURIComponent(orderId)}`)], user)
      return ok(res, { order: fresh[0] })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return serverError(res, error)
  }
}
