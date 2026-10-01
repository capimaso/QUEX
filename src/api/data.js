import { restRequest, rpc, getSession } from '@/lib/supabaseRest'

const fallbackImage = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

function first(row) { return Array.isArray(row) ? row[0] || null : row || null }

export function mapProduct(row) {
  if (!row) return null
  return {
    id: row.id,
    seller_id: row.vendedor_id ?? row.seller_id ?? null,
    seller_email: row.vendedor_email ?? row.seller_email ?? null,
    seller_name: row.vendedor_nome ?? row.seller_name ?? 'Pescador local',
    name: row.nome ?? row.name ?? '',
    category: row.categoria ?? row.category ?? 'peixe',
    species: row.especie ?? row.species ?? '',
    description: row.descricao ?? row.description ?? '',
    price: Number(row.preco ?? row.price ?? 0),
    quantity: Number(row.quantidade ?? row.quantity ?? 0),
    unit: row.unidade ?? row.unit ?? 'kg',
    active: row.ativo ?? row.active ?? true,
    image_url: row.fotos_url ?? row.image_url ?? fallbackImage,
    has_bones: Boolean(row.tem_espinha ?? row.has_bones),
    water_type: row.tipo_agua ?? row.water_type ?? 'doce',
    created_at: row.created_at ?? row.created_date,
    updated_at: row.updated_at,
  }
}

export async function listProducts({ activeOnly = true } = {}) {
  const filters = activeOnly ? '&ativo=eq.true' : ''
  const rows = await restRequest(`/produto?select=*&order=created_at.desc${filters}`)
  return (rows || []).map(mapProduct)
}

export async function getProduct(id) {
  const rows = await restRequest(`/produto?select=*&id=eq.${encodeURIComponent(id)}&limit=1`)
  return mapProduct(first(rows))
}

export async function saveProduct(form, user, id = 'new') {
  if (!user?.id) throw new Error('Você precisa estar autenticado para cadastrar produtos.')
  const payload = {
    vendedor_id: user.id,
    vendedor_email: user.email,
    vendedor_nome: user.business_name || user.full_name || user.email,
    nome: form.name.trim(),
    categoria: form.category,
    especie: form.species.trim(),
    descricao: form.description.trim() || null,
    preco: Number(form.price),
    quantidade: Number(form.quantity),
    unidade: form.unit,
    ativo: Boolean(form.active),
    fotos_url: form.image_url.trim() || null,
    tem_espinha: Boolean(form.has_bones),
    tipo_agua: form.water_type,
  }

  if (id === 'new') {
    const rows = await restRequest('/produto', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    })
    return mapProduct(first(rows))
  }

  const rows = await restRequest(`/produto?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return mapProduct(first(rows))
}

export async function removeProduct(id) {
  await restRequest(`/produto?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function toggleProduct(id, active) {
  const rows = await restRequest(`/produto?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ativo: active }),
  })
  return mapProduct(first(rows))
}

export async function getProfile(userId) {
  const rows = await restRequest(`/profiles?select=*&id=eq.${encodeURIComponent(userId)}&limit=1`)
  return first(rows)
}

export async function updateProfile(userId, payload) {
  const rows = await restRequest(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  })
  return first(rows)
}

function mapCart(row) {
  return {
    id: row.id,
    buyer_id: row.buyer_id,
    product_id: row.product_id,
    product_name: row.product_name,
    product_price: Number(row.product_price),
    product_image: row.product_image,
    seller_name: row.seller_name,
    quantity: Number(row.quantity),
    subtotal: Number(row.subtotal),
    product: row.product ? mapProduct(row.product) : null,
  }
}

export async function listCart(userId) {
  const rows = await restRequest(`/cart_items?select=*&buyer_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`)
  const mapped = (rows || []).map(mapCart)
  return Promise.all(mapped.map(async (item) => ({ ...item, product: await getProduct(item.product_id) })))
}

export async function addToCart(user, product, quantity) {
  if (user?.role === 'seller') throw new Error('Vendedores não podem adicionar produtos ao próprio carrinho.')
  if (!product || quantity < 1) throw new Error('Quantidade inválida.')
  if (quantity > product.quantity) throw new Error('Quantidade maior que o estoque disponível.')
  const existingRows = await restRequest(`/cart_items?select=*&buyer_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(product.id)}&limit=1`)
  const existing = first(existingRows)
  const nextQuantity = Math.min(Number(existing?.quantity || 0) + quantity, product.quantity)
  const payload = {
    buyer_id: user.id,
    product_id: product.id,
    product_name: product.name,
    product_price: product.price,
    product_image: product.image_url,
    seller_name: product.seller_name,
    quantity: nextQuantity,
    subtotal: nextQuantity * product.price,
  }
  if (existing) {
    const rows = await restRequest(`/cart_items?id=eq.${encodeURIComponent(existing.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    })
    return mapCart(first(rows))
  }
  const rows = await restRequest('/cart_items', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
  })
  return mapCart(first(rows))
}

export async function updateCartItem(id, quantity, maxQuantity) {
  const qty = Math.max(1, Math.min(Number(quantity), Number(maxQuantity)))
  const rows = await restRequest(`/cart_items?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ quantity: qty }),
  })
  const row = first(rows)
  if (row) {
    await restRequest(`/cart_items?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ subtotal: Number(row.product_price) * qty }),
    })
  }
  return row ? { ...mapCart(row), quantity: qty, subtotal: Number(row.product_price) * qty } : null
}

export async function removeCartItem(id) {
  await restRequest(`/cart_items?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function checkout(items, buyer, deliveryAddress) {
  const clean = (items || []).map((item) => ({ product_id: item.product_id, quantity: item.quantity }))
  if (!clean.length) throw new Error('Seu carrinho está vazio.')
  if (!buyer?.id) throw new Error('Usuário não autenticado.')
  return rpc('quex_create_order', {
    p_items: clean,
    p_delivery_address: deliveryAddress.trim(),
  })
}

export async function listBuyerOrders(userId) {
  const orders = await restRequest(`/orders?select=*&buyer_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`)
  return attachOrderItems(orders || [])
}

export async function listSellerOrders() {
  const orders = await restRequest('/orders?select=*&order=created_at.desc')
  return attachOrderItems(orders || [])
}

async function attachOrderItems(orders) {
  if (!orders.length) return []
  const ids = orders.map((o) => o.id).join(',')
  const items = await restRequest(`/order_items?select=*&order_id=in.(${ids})&order=created_at.asc`)
  const byOrder = new Map()
  for (const item of items || []) {
    if (!byOrder.has(item.order_id)) byOrder.set(item.order_id, [])
    byOrder.get(item.order_id).push(item)
  }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }))
}

export async function updateOrderStatus(orderId, status) {
  const patch = { status }
  if (status === 'dispatched') {
    patch.tracking_code = `QX-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    patch.delivery_status = 'in_transit'
  }
  if (status === 'delivered') patch.delivery_status = 'delivered'
  const rows = await restRequest(`/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  return first(rows)
}

export async function cartCount(userId) {
  const rows = await restRequest(`/cart_items?select=id&buyer_id=eq.${encodeURIComponent(userId)}`)
  return rows?.length || 0
}

export function currentAccessToken() { return getSession()?.access_token || null }

export { fallbackImage }
