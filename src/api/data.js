import { apiRequest } from './client'
import { supabase } from '@/lib/supabase'
import { compressAvatar } from '@/lib/image'

export const fallbackImage = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

export async function listProducts({ activeOnly = true, search = '', sellerId } = {}) {
  const params = new URLSearchParams()
  if (sellerId) params.set('seller_id', String(sellerId))
  if (!activeOnly) params.set('active', 'false')
  if (search.trim()) params.set('search', search.trim())
  const query = params.toString()
  const data = await apiRequest(`/api/products${query ? `?${query}` : ''}`)
  return data.products || []
}

export async function getProduct(id, includeInactive = false) {
  const suffix = includeInactive ? '&active=false' : ''
  const data = await apiRequest(`/api/products?id=${encodeURIComponent(id)}${suffix}`)
  return data.product || null
}

export async function saveProduct(form, _user, id = 'new') {
  const payload = {
    name: form.name,
    species: form.species,
    description: form.description,
    price: Number(form.price),
    quantity: Number(form.quantity),
    unit: form.unit,
    active: Boolean(form.active),
    image_url: form.image_url,
    has_bones: Boolean(form.has_bones),
    water_type: form.water_type,
  }
  if (id === 'new') return (await apiRequest('/api/products', { method: 'POST', body: JSON.stringify(payload) })).product
  return (await apiRequest(`/api/products?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })).product
}

export async function removeProduct(id) {
  return apiRequest(`/api/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function toggleProduct(id, active) {
  return (await apiRequest(`/api/products?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active }) })).product
}

export async function listCart() {
  return apiRequest('/api/cart')
}

export async function addToCart(_user, product, quantity) {
  return apiRequest('/api/cart', { method: 'POST', body: JSON.stringify({ product_id: product.id, quantity }) })
}

export async function updateCartItem(id, quantity) {
  return apiRequest(`/api/cart?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
}

export async function removeCartItem(id) {
  return apiRequest(`/api/cart?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function checkout(_items, _buyer, address, paymentMethod = 'pix') {
  const data = await apiRequest('/api/checkout', { method: 'POST', body: JSON.stringify({ address, payment_method: paymentMethod }) })
  return data.order
}

export async function listBuyerOrders() {
  return (await apiRequest('/api/orders')).orders || []
}

export async function listSellerOrders() {
  return (await apiRequest('/api/orders')).orders || []
}

export async function updateOrderStatus(orderId, status) {
  return (await apiRequest(`/api/orders?id=${encodeURIComponent(orderId)}`, { method: 'PATCH', body: JSON.stringify({ status }) })).order
}

export async function cartCount() {
  const data = await apiRequest('/api/cart')
  return data.items?.length || 0
}

export async function updateProfile(payload) {
  return (await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(payload) })).user
}

export async function changePassword(currentPassword, newPassword) {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) throw new Error('Sessão expirada. Entre de novo.')
  // Quem entrou só com Google não tem senha ainda: nesse caso não há "senha atual" pra conferir.
  if (currentPassword !== null) {
    const check = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (check.error) throw new Error('A senha atual está incorreta.')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message || 'Não foi possível alterar a senha.')
  return { ok: true }
}

// ---------- perfis públicos ----------
export async function listSellers({ search = '', location = '', limit = 24, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search.trim()) params.set('search', search.trim())
  if (location.trim()) params.set('location', location.trim())
  return (await apiRequest(`/api/people?${params}`)).people || []
}

export async function getPerson(id) {
  return (await apiRequest(`/api/people?id=${encodeURIComponent(id)}`)).person
}

// ---------- foto de perfil (Supabase Storage) ----------
// 1) reduz/corta no navegador  2) sobe pro bucket "avatars" na pasta do próprio usuário
// 3) avisa a API, que valida o caminho, salva em usuario.foto_perfil e apaga a foto antiga.
export async function uploadAvatar(file, authUserId) {
  const blob = await compressAvatar(file)
  const path = `${authUserId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
  if (error) {
    console.error('[QUÉX] upload da foto falhou:', error)
    if (/bucket not found/i.test(error.message || '')) throw new Error('O armazenamento de fotos ainda não foi configurado (falta rodar o modulo3_perfis.sql no Supabase).')
    throw new Error('Não foi possível enviar a foto. Tenta de novo.')
  }
  return (await apiRequest('/api/profile', { method: 'PATCH', body: JSON.stringify({ photo_path: path }) })).user
}

export async function removeAvatar() {
  return (await apiRequest('/api/profile', { method: 'PATCH', body: JSON.stringify({ photo_path: null }) })).user
}
