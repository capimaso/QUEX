import { apiRequest } from './client'

export async function listNotifications() {
  return apiRequest('/api/notifications')
}

export async function markNotificationRead(id) {
  return apiRequest(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PUT' }
  )
}

export async function markAllNotificationsRead() {
  return apiRequest('/api/notifications/read-all', {
    method: 'PUT',
  })
}

export async function deleteOwnAccount() {
  return apiRequest('/api/account', {
    method: 'DELETE',
  })
}

export async function deleteAdminUser(id) {
  return apiRequest(
    `/api/admin/usuarios/${encodeURIComponent(id)}/excluir`,
    { method: 'DELETE' }
  )
}

export async function listAdminProducts() {
  const data = await apiRequest('/api/admin/produtos')
  return data.products || []
}

export async function retainAdminProduct(id, reason) {
  return apiRequest(
    `/api/admin/produtos/${encodeURIComponent(id)}/reter`,
    {
      method: 'POST',
      body: JSON.stringify({ motivo: reason }),
    }
  )
}

export async function reactivateAdminProduct(id) {
  return apiRequest(
    `/api/admin/produtos/${encodeURIComponent(id)}/reativar`,
    { method: 'POST' }
  )
}

export async function listAdminOrders() {
  const data = await apiRequest('/api/admin/pedidos')
  return data.orders || []
}

export async function getAdminOrder(id) {
  const data = await apiRequest(
    `/api/admin/pedidos/${encodeURIComponent(id)}`
  )
  return data.order
}
