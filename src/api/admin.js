import { apiRequest } from './client'

export async function listAdminTickets() {
  return (
    await apiRequest(
      '/api/admin/tickets'
    )
  ).tickets || []
}

export async function getAdminTicket(id) {
  return apiRequest(
    `/api/admin/tickets/${encodeURIComponent(id)}`
  )
}

export async function replyAdminTicket(
  id,
  mensagem
) {
  return apiRequest(
    `/api/admin/tickets/${encodeURIComponent(id)}/reply`,
    {
      method: 'POST',
      body: JSON.stringify({
        mensagem,
      }),
    }
  )
}

export async function setAdminTicketStatus(
  id,
  status
) {
  return apiRequest(
    `/api/admin/tickets/${encodeURIComponent(id)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({
        status,
      }),
    }
  )
}

export async function listAdminUsers() {
  return (
    await apiRequest(
      '/api/admin/usuarios'
    )
  ).users || []
}

export async function banAdminUser(
  id,
  motivo
) {
  return apiRequest(
    `/api/admin/usuarios/${encodeURIComponent(id)}/banir`,
    {
      method: 'POST',
      body: JSON.stringify({
        motivo,
      }),
    }
  )
}

export async function listAdminClaims() {
  return (
    await apiRequest(
      '/api/admin/reivindicacoes'
    )
  ).claims || []
}

export async function approveAdminClaim(id) {
  return apiRequest(
    `/api/admin/reivindicacoes/${encodeURIComponent(id)}/aprovar`,
    {
      method: 'POST',
    }
  )
}

export async function rejectAdminClaim(
  id,
  motivo = ''
) {
  return apiRequest(
    `/api/admin/reivindicacoes/${encodeURIComponent(id)}/rejeitar`,
    {
      method: 'POST',
      body: JSON.stringify({
        motivo,
      }),
    }
  )
}
