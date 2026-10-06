import {
  deleteWhere,
  insertOne,
  selectOne,
  supabaseRequest,
  updateOne,
} from './_lib/db.js'
import { requireUser, resolveAccount } from './_lib/auth.js'
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

const TICKET_REASONS = new Set([
  'problema_pedido',
  'problema_pagamento',
  'problema_vendedor',
  'problema_comprador',
  'duvida_geral',
  'outros',
])

const cleanText = value => String(value ?? '').trim()

function ticketLabel(numero) {
  return `#${String(numero).padStart(4, '0')}`
}

async function createTicketRecord({ userId = null, reason, message }) {
  const ticket = await insertOne('ticket', {
    usuario_id: userId == null ? null : Number(userId),
    motivo: reason,
    mensagem: message,
    status: 'aberto',
  })

  try {
    await insertOne('ticket_mensagem', {
      ticket_id: Number(ticket.id),
      autor_id: userId == null ? null : Number(userId),
      mensagem: message,
      is_adm: false,
    })
  } catch (error) {
    await deleteWhere('ticket', `id=eq.${encodeURIComponent(ticket.id)}`).catch(() => {})
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
    return badRequest(res, 'Explique o motivo da reivindicação com um pouco mais de detalhe.')
  }
  if (motivo.length > 1000) {
    return badRequest(res, 'O motivo pode ter no máximo 1000 caracteres.')
  }

  const buyer = await selectOne('comprador', `cpf=eq.${encodeURIComponent(cpf)}`)
  const seller = buyer
    ? null
    : await selectOne('vendedor', `cpf_cnpj=eq.${encodeURIComponent(cpf)}`)

  if (!buyer && !seller) {
    return notFound(res, 'Não encontramos uma conta cadastrada com esse CPF.')
  }

  const claim = await insertOne('reivindicacao_cpf', {
    cpf,
    email,
    telefone,
    motivo,
    status: 'aberta',
  })

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
    return badRequest(res, 'A mensagem deve ter entre 1 e 2000 caracteres.')
  }

  const ticket = await selectOne('ticket', `id=eq.${encodeURIComponent(ticketId)}`)
  if (!ticket) return notFound(res, 'Ticket não encontrado.')

  if (Number(ticket.usuario_id) !== Number(user.id)) {
    return forbidden(res, 'Você não pode responder a este ticket.')
  }

  const row = await insertOne('ticket_mensagem', {
    ticket_id: ticketId,
    autor_id: Number(user.id),
    mensagem: message,
    is_adm: false,
  })

  await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(ticketId)}`,
    {
      status: 'aberto',
    }
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

  if (
    !Number.isInteger(ticketId) ||
    ticketId <= 0
  ) {
    return badRequest(
      res,
      'Ticket inválido.'
    )
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(ticketId)}`
  )

  if (!ticket) {
    return notFound(
      res,
      'Ticket não encontrado.'
    )
  }

  // Segurança:
  // o usuário só pode abrir o próprio ticket.
  if (
    Number(ticket.usuario_id) !==
    Number(user.id)
  ) {
    return forbidden(
      res,
      'Você não pode acessar este ticket.'
    )
  }

  const messages =
    await supabaseRequest(
      `/ticket_mensagem?select=id,ticket_id,autor_id,mensagem,data_envio,is_adm&ticket_id=eq.${encodeURIComponent(ticketId)}&order=data_envio.asc`
    )

  return ok(res, {
    ticket: {
      id: Number(ticket.id),
      numero: Number(ticket.numero),
      label: ticketLabel(
        ticket.numero
      ),
      motivo: ticket.motivo,
      status: ticket.status,
      data_criacao:
        ticket.data_criacao,
      data_atualizacao:
        ticket.data_atualizacao,
    },

    messages: (messages || []).map(
      message => ({
        id: Number(message.id),

        ticket_id: Number(
          message.ticket_id
        ),

        autor_id:
          message.autor_id == null
            ? null
            : Number(
                message.autor_id
              ),

        mensagem:
          message.mensagem,

        data_envio:
          message.data_envio,

        is_adm:
          Boolean(
            message.is_adm
          ),
      })
    ),
  })
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST' && req.query?.resource === 'claim-cpf') {
      return createCpfClaim(req, res)
    }

    if (req.method === 'POST' && req.query?.resource === 'message') {
      return addTicketMessage(req, res)
    }

    if (req.method === 'POST') {
      const account = await resolveAccount(req)
      const user = account?.usuario?.is_active ? account.usuario : null
      const body = readBody(req)
      const reason = cleanText(body.motivo)
      const message = cleanText(body.mensagem)

      if (!TICKET_REASONS.has(reason)) {
        return badRequest(res, 'Selecione um motivo de atendimento válido.')
      }

      if (message.length < 5) {
        return badRequest(res, 'Escreva uma mensagem com um pouco mais de detalhe.')
      }

      if (message.length > 2000) {
        return badRequest(res, 'A mensagem pode ter no máximo 2000 caracteres.')
      }

      const ticket = await createTicketRecord({
        userId: user?.id || null,
        reason,
        message,
      })

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

    if (
      req.method === 'GET' &&
      req.query?.resource === 'ticket'
    ) {
      return getTicketDetail(
        req,
        res
      )
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

    return methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    return serverError(res, error)
  }
}
