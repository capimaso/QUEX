import {
  deleteWhere,
  insertOne,
  selectOne,
  supabaseRequest,
  updateOne,
} from './_lib/db.js'
import { requireUser, resolveAccount } from './_lib/auth.js'
import { resolveAdmin } from './_lib/admin.js'
import {
  badRequest,
  created,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  readBody,
  serverError,
  unauthorized,
} from './_lib/http.js'
import { onlyDigits, validarCPF } from './_lib/documents.js'
import {
  antiContact,
  CONTACT_WARNING,
} from './_lib/antiContact.js'

const TICKET_REASONS = new Set([
  'problema_pedido',
  'problema_pagamento',
  'problema_vendedor',
  'problema_comprador',
  'duvida_geral',
  'outros',
])

const TICKET_STATUSES = new Set([
  'aberto',
  'respondido',
  'fechado',
])

const cleanText = value => String(value ?? '').trim()

function ticketLabel(numero) {
  return `#${String(numero).padStart(4, '0')}`
}

async function createTicketRecord({
  userId = null,
  reason,
  message,
  blocked = false,
  blockReason = null,
}) {
  const visibleSummary = blocked
    ? '[Mensagem bloqueada pelo filtro anti-contato]'
    : message

  const ticket = await insertOne('ticket', {
    usuario_id: userId == null ? null : Number(userId),
    motivo: reason,
    mensagem: visibleSummary,
    status: blocked ? 'fechado' : 'aberto',
  })

  try {
    await insertOne('ticket_mensagem', {
      ticket_id: Number(ticket.id),
      autor_id: userId == null ? null : Number(userId),
      mensagem: message,
      is_adm: false,
      bloqueada: Boolean(blocked),
      motivo_bloqueio: blocked ? blockReason : null,
    })
  } catch (error) {
    await deleteWhere(
      'ticket',
      `id=eq.${encodeURIComponent(ticket.id)}`
    ).catch(() => {})
    throw error
  }

  return ticket
}

async function createCpfClaim(req, res) {
  const body = readBody(req)
  const cpf = onlyDigits(body.cpf)
  const email = cleanText(body.email).toLowerCase()
  const telefone = cleanText(body.telefone)
  const motivo = cleanText(body.motivo)

  if (!validarCPF(cpf)) return badRequest(res, 'CPF inválido.')

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest(res, 'Informe um e-mail válido para contato.')
  }

  const phoneDigits = onlyDigits(telefone)

  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    return badRequest(res, 'Informe um telefone válido com DDD.')
  }

  if (motivo.length < 10) {
    return badRequest(
      res,
      'Explique o motivo da reivindicação com um pouco mais de detalhe.'
    )
  }

  if (motivo.length > 1000) {
    return badRequest(res, 'O motivo pode ter no máximo 1000 caracteres.')
  }

  const buyer = await selectOne(
    'comprador',
    `cpf=eq.${encodeURIComponent(cpf)}`
  )

  const seller = buyer
    ? null
    : await selectOne(
        'vendedor',
        `cpf_cnpj=eq.${encodeURIComponent(cpf)}`
      )

  if (!buyer && !seller) {
    return notFound(
      res,
      'Não encontramos uma conta cadastrada com esse CPF.'
    )
  }

  const claim = await insertOne('reivindicacao_cpf', {
    cpf,
    email,
    telefone,
    motivo,
    status: 'aberta',
  })

  // Exceção intencional: a reivindicação de CPF é um fluxo de recuperação
  // de conta e precisa armazenar os dados de contato informados pelo titular.
  const message = [
    `Reivindicação de CPF #${claim.id}`,
    `CPF: ${cpf}`,
    `E-mail informado: ${email}`,
    `Telefone informado: ${telefone}`,
    `Motivo: ${motivo}`,
  ].join('\n')

  try {
    const ticket = await createTicketRecord({
      userId: null,
      reason: 'reivindicacao_cpf',
      message,
    })

    return created(res, {
      claim: {
        id: Number(claim.id),
        status: claim.status || 'aberta',
      },
      ticket: {
        id: Number(ticket.id),
        numero: Number(ticket.numero),
        label: ticketLabel(ticket.numero),
        status: ticket.status || 'aberto',
      },
    })
  } catch (error) {
    await deleteWhere(
      'reivindicacao_cpf',
      `id=eq.${encodeURIComponent(claim.id)}`
    ).catch(() => {})

    throw error
  }
}

async function addTicketMessage(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const body = readBody(req)
  const ticketId = Number(body.ticket_id)
  const message = cleanText(body.mensagem)

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return badRequest(res, 'Ticket inválido.')
  }

  if (message.length < 1 || message.length > 2000) {
    return badRequest(
      res,
      'A mensagem deve ter entre 1 e 2000 caracteres.'
    )
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(ticketId)}`
  )

  if (!ticket) return notFound(res, 'Ticket não encontrado.')

  if (Number(ticket.usuario_id) !== Number(user.id)) {
    return forbidden(res, 'Você não pode responder a este ticket.')
  }

  const filter = antiContact(message)

  const row = await insertOne('ticket_mensagem', {
    ticket_id: ticketId,
    autor_id: Number(user.id),
    mensagem: message,
    is_adm: false,
    bloqueada: filter.bloqueado,
    motivo_bloqueio: filter.motivo,
  })

  if (filter.bloqueado) {
    return badRequest(res, CONTACT_WARNING)
  }

  await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(ticketId)}`,
    { status: 'aberto' }
  )

  return created(res, {
    message: {
      id: Number(row.id),
      ticket_id: ticketId,
      mensagem: row.mensagem,
      data_envio: row.data_envio,
    },
  })
}

async function getTicketDetail(req, res) {
  const user = await requireUser(req)

  if (!user) {
    return unauthorized(res)
  }

  const ticketId = Number(req.query?.id)

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return badRequest(res, 'Ticket inválido.')
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(ticketId)}`
  )

  if (!ticket) {
    return notFound(res, 'Ticket não encontrado.')
  }

  if (Number(ticket.usuario_id) !== Number(user.id)) {
    return forbidden(res, 'Você não pode acessar este ticket.')
  }

  const messages = await supabaseRequest(
    `/ticket_mensagem?select=id,ticket_id,autor_id,mensagem,data_envio,is_adm&ticket_id=eq.${encodeURIComponent(ticketId)}&bloqueada=eq.false&order=data_envio.asc`
  )

  return ok(res, {
    ticket: {
      id: Number(ticket.id),
      numero: Number(ticket.numero),
      label: ticketLabel(ticket.numero),
      motivo: ticket.motivo,
      status: ticket.status,
      data_criacao: ticket.data_criacao,
      data_atualizacao: ticket.data_atualizacao,
    },
    messages: (messages || []).map(message => ({
      id: Number(message.id),
      ticket_id: Number(message.ticket_id),
      autor_id:
        message.autor_id == null
          ? null
          : Number(message.autor_id),
      mensagem: message.mensagem,
      data_envio: message.data_envio,
      is_adm: Boolean(message.is_adm),
    })),
  })
}

async function requireAdmin(req, res) {
  const actor = await resolveAdmin(req)

  if (!actor.user) {
    unauthorized(res)
    return null
  }

  if (!actor.allowed) {
    forbidden(res, 'Apenas ADM ou CEO pode acessar esta área.')
    return null
  }

  return actor
}

async function adminUsersMap(ids) {
  const cleanIds = [
    ...new Set(ids.map(Number).filter(Boolean)),
  ]

  if (!cleanIds.length) return new Map()

  const rows = await supabaseRequest(
    `/usuario?select=id,nome,email&id=in.(${cleanIds.join(',')})`
  )

  return new Map(
    (rows || []).map(row => [Number(row.id), row])
  )
}

async function adminListTickets(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const rows = await supabaseRequest(
    '/ticket?select=*&order=data_criacao.desc'
  )

  const map = await adminUsersMap(
    (rows || []).map(row => row.usuario_id)
  )

  return ok(res, {
    tickets: (rows || []).map(row => {
      const owner = map.get(Number(row.usuario_id))

      return {
        id: Number(row.id),
        numero: Number(row.numero),
        label: ticketLabel(row.numero),
        usuario_id:
          row.usuario_id == null
            ? null
            : Number(row.usuario_id),
        usuario_nome: owner?.nome || 'Visitante',
        usuario_email: owner?.email || '',
        motivo: row.motivo,
        mensagem: row.mensagem,
        status: row.status,
        data_criacao: row.data_criacao,
        data_atualizacao: row.data_atualizacao,
      }
    }),
    viewer_level: actor.level,
  })
}

async function adminTicketDetail(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const id = Number(req.query?.id)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Ticket inválido.')
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!ticket) {
    return notFound(res, 'Ticket não encontrado.')
  }

  const messages = await supabaseRequest(
    `/ticket_mensagem?select=id,ticket_id,autor_id,mensagem,data_envio,is_adm&ticket_id=eq.${encodeURIComponent(id)}&bloqueada=eq.false&order=data_envio.asc`
  )

  const authorMap = await adminUsersMap([
    ticket.usuario_id,
    ...(messages || []).map(item => item.autor_id),
  ])

  const owner = authorMap.get(Number(ticket.usuario_id))

  return ok(res, {
    ticket: {
      id: Number(ticket.id),
      numero: Number(ticket.numero),
      label: ticketLabel(ticket.numero),
      usuario_id:
        ticket.usuario_id == null
          ? null
          : Number(ticket.usuario_id),
      usuario_nome: owner?.nome || 'Visitante',
      usuario_email: owner?.email || '',
      motivo: ticket.motivo,
      status: ticket.status,
      data_criacao: ticket.data_criacao,
      data_atualizacao: ticket.data_atualizacao,
    },
    messages: (messages || []).map(item => ({
      id: Number(item.id),
      ticket_id: Number(item.ticket_id),
      autor_id:
        item.autor_id == null
          ? null
          : Number(item.autor_id),
      autor_nome: item.is_adm
        ? 'Administração QUÉX'
        : authorMap.get(Number(item.autor_id))?.nome || 'Usuário',
      mensagem: item.mensagem,
      data_envio: item.data_envio,
      is_adm: Boolean(item.is_adm),
    })),
  })
}

async function adminReplyTicket(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const id = Number(req.query?.id)
  const body = readBody(req)
  const message = cleanText(body.mensagem)

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Ticket inválido.')
  }

  if (message.length < 1 || message.length > 2000) {
    return badRequest(
      res,
      'A mensagem deve ter entre 1 e 2000 caracteres.'
    )
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!ticket) {
    return notFound(res, 'Ticket não encontrado.')
  }

  if (ticket.status === 'fechado') {
    return badRequest(res, 'Reabra o ticket antes de responder.')
  }

  const filter = antiContact(message)

  const row = await insertOne('ticket_mensagem', {
    ticket_id: id,
    autor_id: Number(actor.user.id),
    mensagem: message,
    is_adm: true,
    bloqueada: filter.bloqueado,
    motivo_bloqueio: filter.motivo,
  })

  if (filter.bloqueado) {
    return badRequest(res, CONTACT_WARNING)
  }

  await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`,
    { status: 'respondido' }
  )

  return created(res, {
    message: {
      id: Number(row.id),
      mensagem: row.mensagem,
      data_envio: row.data_envio,
      is_adm: true,
    },
  })
}

async function adminUpdateTicketStatus(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const id = Number(req.query?.id)
  const body = readBody(req)
  const status = cleanText(body.status).toLowerCase()

  if (!Number.isInteger(id) || id <= 0) {
    return badRequest(res, 'Ticket inválido.')
  }

  if (!TICKET_STATUSES.has(status)) {
    return badRequest(res, 'Status de ticket inválido.')
  }

  const ticket = await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`,
    { status }
  )

  if (!ticket) {
    return notFound(res, 'Ticket não encontrado.')
  }

  return ok(res, {
    ticket: {
      id: Number(ticket.id),
      numero: Number(ticket.numero),
      label: ticketLabel(ticket.numero),
      status: ticket.status,
    },
  })
}

async function getChatForParticipant(user, chatId) {
  const chat = await selectOne(
    'chat',
    `id=eq.${encodeURIComponent(chatId)}`
  )

  if (!chat) return null

  const participant =
    Number(chat.comprador_id) === Number(user.id) ||
    Number(chat.vendedor_id) === Number(user.id)

  return participant ? chat : null
}

async function mapChats(rows, user) {
  if (!rows?.length) return []

  const counterpartIds = [
    ...new Set(
      rows.map(row =>
        Number(user.id) === Number(row.comprador_id)
          ? Number(row.vendedor_id)
          : Number(row.comprador_id)
      )
    ),
  ]

  const users = counterpartIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome&id=in.(${counterpartIds.join(',')})`
      )
    : []

  const shops = counterpartIds.length
    ? await supabaseRequest(
        `/vendedor?select=id,comercial&id=in.(${counterpartIds.join(',')})`
      )
    : []

  const orders = await supabaseRequest(
    `/pedido?select=id,status&id=in.(${[
      ...new Set(rows.map(row => Number(row.pedido_id))),
    ].join(',')})`
  )

  const userMap = new Map(
    (users || []).map(row => [Number(row.id), row])
  )

  const shopMap = new Map(
    (shops || []).map(row => [Number(row.id), row])
  )

  const orderMap = new Map(
    (orders || []).map(row => [Number(row.id), row])
  )

  return rows.map(row => {
    const buyerViewing =
      Number(user.id) === Number(row.comprador_id)

    const counterpartId = buyerViewing
      ? Number(row.vendedor_id)
      : Number(row.comprador_id)

    const counterpart = userMap.get(counterpartId)
    const shop = shopMap.get(counterpartId)
    const order = orderMap.get(Number(row.pedido_id))

    return {
      id: Number(row.id),
      comprador_id: Number(row.comprador_id),
      vendedor_id: Number(row.vendedor_id),
      pedido_id: Number(row.pedido_id),
      data_criacao: row.data_criacao,
      data_ultima_mensagem: row.data_ultima_mensagem,
      pedido_status: order?.status || '',
      counterpart_id: counterpartId,
      counterpart_name: buyerViewing
        ? shop?.comercial || counterpart?.nome || 'Vendedor'
        : counterpart?.nome || 'Comprador',
      counterpart_role: buyerViewing ? 'seller' : 'buyer',
    }
  })
}

async function listChats(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const filter =
    user.tipo === 'vendedor'
      ? `vendedor_id=eq.${encodeURIComponent(user.id)}`
      : `comprador_id=eq.${encodeURIComponent(user.id)}`

  const rows = await supabaseRequest(
    `/chat?select=*&${filter}&order=data_ultima_mensagem.desc.nullslast,data_criacao.desc`
  )

  let mapped = await mapChats(rows || [], user)

  const orderId = Number(req.query?.pedido_id)
  const sellerId = Number(req.query?.vendedor_id)

  if (Number.isInteger(orderId) && orderId > 0) {
    mapped = mapped.filter(item => item.pedido_id === orderId)
  }

  if (Number.isInteger(sellerId) && sellerId > 0) {
    mapped = mapped.filter(item => item.vendedor_id === sellerId)
  }

  return ok(res, {
    chats: mapped,
  })
}

async function getChatMessages(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const chatId = Number(req.query?.chat_id)

  if (!Number.isInteger(chatId) || chatId <= 0) {
    return badRequest(res, 'Chat inválido.')
  }

  const chat = await getChatForParticipant(user, chatId)

  if (!chat) {
    return forbidden(res, 'Você não participa deste chat.')
  }

  const messages = await supabaseRequest(
    `/mensagem_chat?select=id,chat_id,remetente_id,mensagem,data_envio,lida&chat_id=eq.${encodeURIComponent(chatId)}&bloqueada=eq.false&removida_em=is.null&order=data_envio.asc`
  )

  const senderIds = [
    ...new Set((messages || []).map(row => Number(row.remetente_id))),
  ]

  const senders = senderIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome&id=in.(${senderIds.join(',')})`
      )
    : []

  const senderMap = new Map(
    (senders || []).map(row => [Number(row.id), row])
  )

  await supabaseRequest(
    `/mensagem_chat?chat_id=eq.${encodeURIComponent(chatId)}&remetente_id=neq.${encodeURIComponent(user.id)}&lida=eq.false&bloqueada=eq.false&removida_em=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ lida: true }),
    }
  ).catch(() => {})

  const [chatInfo] = await mapChats([chat], user)

  return ok(res, {
    chat: chatInfo,
    messages: (messages || []).map(row => ({
      id: Number(row.id),
      chat_id: Number(row.chat_id),
      remetente_id: Number(row.remetente_id),
      remetente_nome:
        senderMap.get(Number(row.remetente_id))?.nome || 'Usuário',
      mensagem: row.mensagem,
      data_envio: row.data_envio,
      lida:
        Number(row.remetente_id) === Number(user.id)
          ? Boolean(row.lida)
          : true,
    })),
  })
}

async function sendChatMessage(req, res) {
  const user = await requireUser(req)
  if (!user) return unauthorized(res)

  const chatId = Number(req.query?.chat_id)
  const body = readBody(req)
  const message = cleanText(body.mensagem)

  if (!Number.isInteger(chatId) || chatId <= 0) {
    return badRequest(res, 'Chat inválido.')
  }

  if (message.length < 1 || message.length > 2000) {
    return badRequest(
      res,
      'A mensagem deve ter entre 1 e 2000 caracteres.'
    )
  }

  const chat = await getChatForParticipant(user, chatId)

  if (!chat) {
    return forbidden(res, 'Você não participa deste chat.')
  }

  const filter = antiContact(message)

  const row = await insertOne('mensagem_chat', {
    chat_id: chatId,
    remetente_id: Number(user.id),
    mensagem: message,
    lida: false,
    bloqueada: filter.bloqueado,
    motivo_bloqueio: filter.motivo,
  })

  if (filter.bloqueado) {
    return badRequest(res, CONTACT_WARNING)
  }

  return created(res, {
    message: {
      id: Number(row.id),
      chat_id: chatId,
      remetente_id: Number(user.id),
      mensagem: row.mensagem,
      data_envio: row.data_envio,
      lida: false,
    },
  })
}

export default async function handler(req, res) {
  try {
    const resource = String(req.query?.resource || '').toLowerCase()

    if (resource === 'claim-cpf' && req.method === 'POST') {
      return createCpfClaim(req, res)
    }

    if (resource === 'message' && req.method === 'POST') {
      return addTicketMessage(req, res)
    }

    if (resource === 'ticket' && req.method === 'GET') {
      return getTicketDetail(req, res)
    }

    if (resource === 'chats' && req.method === 'GET') {
      return listChats(req, res)
    }

    if (resource === 'chat_messages' && req.method === 'GET') {
      return getChatMessages(req, res)
    }

    if (resource === 'chat_messages' && req.method === 'POST') {
      return sendChatMessage(req, res)
    }

    if (resource === 'admin_tickets' && req.method === 'GET') {
      return adminListTickets(req, res)
    }

    if (resource === 'admin_ticket' && req.method === 'GET') {
      return adminTicketDetail(req, res)
    }

    if (resource === 'admin_ticket_reply' && req.method === 'POST') {
      return adminReplyTicket(req, res)
    }

    if (resource === 'admin_ticket_status' && req.method === 'PUT') {
      return adminUpdateTicketStatus(req, res)
    }

    if (req.method === 'POST') {
      const account = await resolveAccount(req)
      const user = account?.usuario?.is_active
        ? account.usuario
        : null

      const body = readBody(req)
      const reason = cleanText(body.motivo)
      const message = cleanText(body.mensagem)

      if (!TICKET_REASONS.has(reason)) {
        return badRequest(
          res,
          'Selecione um motivo de atendimento válido.'
        )
      }

      if (message.length < 5) {
        return badRequest(
          res,
          'Escreva uma mensagem com um pouco mais de detalhe.'
        )
      }

      if (message.length > 2000) {
        return badRequest(
          res,
          'A mensagem pode ter no máximo 2000 caracteres.'
        )
      }

      const filter = antiContact(message)

      const ticket = await createTicketRecord({
        userId: user?.id || null,
        reason,
        message,
        blocked: filter.bloqueado,
        blockReason: filter.motivo,
      })

      if (filter.bloqueado) {
        return badRequest(res, CONTACT_WARNING)
      }

      return created(res, {
        ticket: {
          id: Number(ticket.id),
          numero: Number(ticket.numero),
          label: ticketLabel(ticket.numero),
          motivo: ticket.motivo,
          status: ticket.status || 'aberto',
          data_criacao: ticket.data_criacao,
        },
      })
    }

    if (req.method === 'GET') {
      const user = await requireUser(req)
      if (!user) return unauthorized(res)

      const rows = await supabaseRequest(
        `/ticket?select=id,numero,motivo,status,data_criacao,data_atualizacao&usuario_id=eq.${encodeURIComponent(user.id)}&order=id.desc`
      )

      return ok(res, {
        tickets: (rows || []).map(row => ({
          id: Number(row.id),
          numero: Number(row.numero),
          label: ticketLabel(row.numero),
          motivo: row.motivo,
          status: row.status,
          data_criacao: row.data_criacao,
          data_atualizacao: row.data_atualizacao,
        })),
      })
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PUT'])
  } catch (error) {
    return serverError(res, error)
  }
}
