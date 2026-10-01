import { apiRequest } from './client'

export const fallbackImage = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

export async function listProducts({ activeOnly = true, search = '' } = {}) {
  const params = new URLSearchParams()
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
  return apiRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) })
}
