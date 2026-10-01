import { supabaseRequest, selectOne, insertOne, updateOne, deleteWhere } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { badRequest, forbidden, notFound, ok, readBody, serverError, unauthorized } from './_lib/http.js'

const fallbackImage = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

async function ensureCart(buyerId) {
  let cart = await selectOne('carrinho', `comprador_id=eq.${encodeURIComponent(buyerId)}`)
  if (cart) return cart
  try {
    cart = await insertOne('carrinho', { comprador_id: Number(buyerId), valor_total: 0 })
    return cart
  } catch {
    return selectOne('carrinho', `comprador_id=eq.${encodeURIComponent(buyerId)}`)
  }
}

async function getProductsByIds(ids) {
  if (!ids.length) return new Map()
  const rows = await supabaseRequest(`/produto?select=*&id=in.(${ids.join(',')})`)
  return new Map((rows || []).map(p => [Number(p.id), p]))
}

async function getSellerInfo(ids) {
  if (!ids.length) return { sellers: new Map(), users: new Map() }
  const sellers = await supabaseRequest(`/vendedor?select=id,comercial&id=in.(${ids.join(',')})`)
  const users = await supabaseRequest(`/usuario?select=id,nome,email&id=in.(${ids.join(',')})`)
  return {
    sellers: new Map((sellers || []).map(s => [Number(s.id), s])),
    users: new Map((users || []).map(u => [Number(u.id), u])),
  }
}

function mapItem(item, product, seller, sellerUser) {
  return {
    id: Number(item.id),
    cart_id: Number(item.carrinho_id),
    product_id: Number(item.produto_id),
    quantity: Number(item.quantidade),
    subtotal: Number((Number(product?.preco || 0) * Number(item.quantidade || 0)).toFixed(2)),
    product_name: product?.nome || 'Produto',
    product_price: Number(product?.preco || 0),
    product_image: product?.fotos_url || fallbackImage,
    seller_id: Number(product?.vendedor_id || 0),
    seller_name: seller?.comercial || sellerUser?.nome || 'Pescador local',
    product: product ? {
      id: Number(product.id), quantity: Number(product.quantidade), price: Number(product.preco || 0), active: Boolean(product.ativo)
    } : null,
  }
}

async function loadCart(buyerId) {
  const cart = await ensureCart(buyerId)
  const rows = await supabaseRequest(`/item_carrinho?select=*&carrinho_id=eq.${encodeURIComponent(cart.id)}&order=id.asc`)
  const productIds = [...new Set((rows || []).map(x => Number(x.produto_id)))]
  const products = await getProductsByIds(productIds)
  const sellerIds = [...new Set([...products.values()].map(x => Number(x.vendedor_id)).filter(Boolean))]
  const { sellers, users } = await getSellerInfo(sellerIds)
  const items = (rows || []).map(item => {
    const product = products.get(Number(item.produto_id))
    const currentSubtotal = Number((Number(product?.preco || 0) * Number(item.quantidade || 0)).toFixed(2))
    if (Number(item.subtotal || 0) !== currentSubtotal) {
      updateOne('item_carrinho', `id=eq.${encodeURIComponent(item.id)}&carrinho_id=eq.${encodeURIComponent(cart.id)}`, { subtotal: currentSubtotal }).catch(() => {})
    }
    return mapItem(item, product, sellers.get(Number(product?.vendedor_id)), users.get(Number(product?.vendedor_id)))
  })
  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  if (Number(cart.valor_total) !== total) await updateOne('carrinho', `id=eq.${encodeURIComponent(cart.id)}`, { valor_total: total })
  return { cart: { id: Number(cart.id), buyer_id: Number(buyerId), total }, items }
}

export default async function handler(req, res) {
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    if (user.tipo !== 'comprador') return forbidden(res, 'Somente compradores possuem carrinho.')

    if (req.method === 'GET') {
      const data = await loadCart(user.id)
      return ok(res, data)
    }

    if (req.method === 'POST') {
      const body = readBody(req)
      const productId = Number(body.product_id)
      const addQuantity = Number(body.quantity)
      if (!Number.isInteger(productId) || !Number.isInteger(addQuantity) || addQuantity < 1) return badRequest(res, 'Produto e quantidade inválidos.')
      const product = await selectOne('produto', `id=eq.${encodeURIComponent(productId)}`)
      if (!product || !product.ativo) return notFound(res, 'Produto não está disponível.')
      if (Number(product.quantidade) < 1) return badRequest(res, 'Produto sem estoque.')
      const cart = await ensureCart(user.id)
      const existing = await selectOne('item_carrinho', `carrinho_id=eq.${encodeURIComponent(cart.id)}&produto_id=eq.${encodeURIComponent(productId)}`)
      const nextQty = Math.min(Number(existing?.quantidade || 0) + addQuantity, Number(product.quantidade))
      const payload = { quantidade: nextQty, subtotal: nextQty * Number(product.preco) }
      if (existing) await updateOne('item_carrinho', `id=eq.${encodeURIComponent(existing.id)}&carrinho_id=eq.${encodeURIComponent(cart.id)}`, payload)
      else await insertOne('item_carrinho', { carrinho_id: Number(cart.id), produto_id: productId, ...payload })
      const data = await loadCart(user.id)
      return ok(res, data)
    }

    if (req.method === 'PATCH') {
      const id = Number(req.query?.id)
      const quantity = Number(req.body?.quantity)
      if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) return badRequest(res, 'Item ou quantidade inválidos.')
      const item = await selectOne('item_carrinho', `id=eq.${encodeURIComponent(id)}`)
      if (!item) return notFound(res, 'Item não encontrado.')
      const cart = await selectOne('carrinho', `id=eq.${encodeURIComponent(item.carrinho_id)}&comprador_id=eq.${encodeURIComponent(user.id)}`)
      if (!cart) return forbidden(res)
      const product = await selectOne('produto', `id=eq.${encodeURIComponent(item.produto_id)}`)
      if (!product || !product.ativo) return badRequest(res, 'Produto indisponível.')
      const nextQty = Math.min(quantity, Number(product.quantidade))
      if (nextQty < 1) return badRequest(res, 'Produto sem estoque.')
      await updateOne('item_carrinho', `id=eq.${encodeURIComponent(id)}`, { quantidade: nextQty, subtotal: nextQty * Number(product.preco) })
      return ok(res, await loadCart(user.id))
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query?.id)
      const item = await selectOne('item_carrinho', `id=eq.${encodeURIComponent(id)}`)
      if (!item) return notFound(res, 'Item não encontrado.')
      const cart = await selectOne('carrinho', `id=eq.${encodeURIComponent(item.carrinho_id)}&comprador_id=eq.${encodeURIComponent(user.id)}`)
      if (!cart) return forbidden(res)
      await deleteWhere('item_carrinho', `id=eq.${encodeURIComponent(id)}`)
      return ok(res, await loadCart(user.id))
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (error) {
    return serverError(res, error)
  }
}
