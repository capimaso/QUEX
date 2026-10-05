import { firstPhotoUrl } from './_lib/photos.js'
import { supabaseRequest, selectOne, updateOne } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from './_lib/http.js'

const statusLabels = {
  pendente: 'Pendente',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  despachado: 'Despachado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

async function buildOrders(orders) {
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
    return {
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

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)

    if (req.method === 'GET') {
      const all = await supabaseRequest(`/pedido?select=*&order=id.desc`)
      const orders = user.tipo === 'comprador'
        ? (all || []).filter(o => Number(o.comprador_id) === Number(user.id))
        : all || []
      const enriched = await buildOrders(orders)
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
      const fresh = await buildOrders([await selectOne('pedido', `id=eq.${encodeURIComponent(orderId)}`)])
      return ok(res, { order: fresh[0] })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return serverError(res, error)
  }
}
