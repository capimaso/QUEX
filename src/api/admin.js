import { apiRequest } from './client'
import {
  normalizeSearchDisplay,
} from '@/lib/text'

function searchSafe(value) {
  if (typeof value === 'string') {
    return normalizeSearchDisplay(
      value
    )
  }

  if (Array.isArray(value)) {
    return value.map(searchSafe)
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    return Object.fromEntries(
      Object.entries(value).map(
        ([key, item]) => [
          key,
          searchSafe(item),
        ]
      )
    )
  }

  return value
}

export async function listAdminTickets() {
  const data =
    await apiRequest(
      '/api/admin/tickets'
    )

  return searchSafe(
    data.tickets || []
  )
}

export async function getAdminTicket(id) {
  const data =
    await apiRequest(
      `/api/admin/tickets/${encodeURIComponent(id)}`
    )

  return searchSafe(data)
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
  const data =
    await apiRequest(
      '/api/admin/usuarios'
    )

  return searchSafe(
    data.users || []
  )
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
  const data =
    await apiRequest(
      '/api/admin/reivindicacoes'
    )

  return searchSafe(
    data.claims || []
  )
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
