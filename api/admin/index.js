import {
  insertOne,
  selectOne,
  supabaseRequest,
  updateOne,
} from '../_lib/db.js'
import {
  accessLevel,
  canBanUser,
  resolveAdmin,
} from '../_lib/admin.js'
import {
  adminUpdateUser,
} from '../_lib/supabaseAuth.js'
import {
  badRequest,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  readBody,
  serverError,
  unauthorized,
} from '../_lib/http.js'

const cleanText = value =>
  String(value ?? '').trim()

const TICKET_STATUSES = new Set([
  'aberto',
  'respondido',
  'fechado',
])

function ticketLabel(numero) {
  return `#${String(numero).padStart(4, '0')}`
}

async function getActor(req, res) {
  const actor = await resolveAdmin(req)

  if (!actor.user) {
    unauthorized(res)
    return null
  }

  if (!actor.allowed) {
    forbidden(
      res,
      'Apenas ADM ou CEO pode acessar esta área.'
    )
    return null
  }

  return actor
}

async function usersMap(ids) {
  const cleanIds = [
    ...new Set(
      ids
        .map(Number)
        .filter(Boolean)
    ),
  ]

  if (!cleanIds.length) {
    return new Map()
  }

  const rows = await supabaseRequest(
    `/usuario?select=id,nome,email,nivel_acesso,tipo&id=in.(${cleanIds.join(',')})`
  )

  return new Map(
    (rows || []).map(row => [
      Number(row.id),
      row,
    ])
  )
}

async function listTickets(req, res, actor) {
  const rows = await supabaseRequest(
    '/ticket?select=*&order=data_criacao.desc'
  )

  const map = await usersMap(
    (rows || []).map(row => row.usuario_id)
  )

  return ok(res, {
    tickets: (rows || []).map(row => {
      const owner = map.get(
        Number(row.usuario_id)
      )

      return {
        id: Number(row.id),
        numero: Number(row.numero),
        label: ticketLabel(row.numero),
        usuario_id:
          row.usuario_id == null
            ? null
            : Number(row.usuario_id),
        usuario_nome:
          owner?.nome || 'Visitante',
        usuario_email:
          owner?.email || '',
        motivo: row.motivo,
        mensagem: row.mensagem,
        status: row.status,
        data_criacao: row.data_criacao,
        data_atualizacao:
          row.data_atualizacao,
      }
    }),
    viewer_level: actor.level,
  })
}

async function ticketDetail(req, res) {
  const id = Number(req.query?.id)

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Ticket inválido.'
    )
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!ticket) {
    return notFound(
      res,
      'Ticket não encontrado.'
    )
  }

  const messages = await supabaseRequest(
    `/ticket_mensagem?select=*&ticket_id=eq.${encodeURIComponent(id)}&order=data_envio.asc`
  )

  const authorIds = [
    ticket.usuario_id,
    ...(messages || []).map(
      message => message.autor_id
    ),
  ]

  const map = await usersMap(authorIds)
  const owner = map.get(
    Number(ticket.usuario_id)
  )

  return ok(res, {
    ticket: {
      id: Number(ticket.id),
      numero: Number(ticket.numero),
      label: ticketLabel(ticket.numero),
      usuario_id:
        ticket.usuario_id == null
          ? null
          : Number(ticket.usuario_id),
      usuario_nome:
        owner?.nome || 'Visitante',
      usuario_email:
        owner?.email || '',
      motivo: ticket.motivo,
      mensagem: ticket.mensagem,
      status: ticket.status,
      data_criacao:
        ticket.data_criacao,
      data_atualizacao:
        ticket.data_atualizacao,
    },
    messages: (messages || []).map(
      message => {
        const author = map.get(
          Number(message.autor_id)
        )

        return {
          id: Number(message.id),
          ticket_id: Number(
            message.ticket_id
          ),
          autor_id:
            message.autor_id == null
              ? null
              : Number(message.autor_id),
          autor_nome:
            author?.nome ||
            (
              message.is_adm
                ? 'Administração QUÉX'
                : 'Visitante'
            ),
          mensagem: message.mensagem,
          data_envio:
            message.data_envio,
          is_adm: Boolean(
            message.is_adm
          ),
        }
      }
    ),
  })
}

async function replyTicket(
  req,
  res,
  actor
) {
  const id = Number(req.query?.id)
  const body = readBody(req)
  const message = cleanText(
    body.mensagem
  )

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Ticket inválido.'
    )
  }

  if (
    message.length < 1 ||
    message.length > 2000
  ) {
    return badRequest(
      res,
      'A resposta deve ter entre 1 e 2000 caracteres.'
    )
  }

  const ticket = await selectOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!ticket) {
    return notFound(
      res,
      'Ticket não encontrado.'
    )
  }

  if (ticket.status === 'fechado') {
    return badRequest(
      res,
      'Este ticket está fechado. Reabra o ticket antes de responder.'
    )
  }

  const row = await insertOne(
    'ticket_mensagem',
    {
      ticket_id: id,
      autor_id: Number(
        actor.user.id
      ),
      mensagem: message,
      is_adm: true,
    }
  )

  await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`,
    { status: 'respondido' }
  )

  return ok(res, {
    message: {
      id: Number(row.id),
      ticket_id: id,
      autor_id: Number(
        actor.user.id
      ),
      autor_nome:
        actor.user.nome ||
        'Administração QUÉX',
      mensagem: row.mensagem,
      data_envio: row.data_envio,
      is_adm: true,
    },
    status: 'respondido',
  })
}

async function updateTicketStatus(
  req,
  res
) {
  const id = Number(req.query?.id)
  const body = readBody(req)
  const status = cleanText(
    body.status
  ).toLowerCase()

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Ticket inválido.'
    )
  }

  if (!TICKET_STATUSES.has(status)) {
    return badRequest(
      res,
      'Status de ticket inválido.'
    )
  }

  const ticket = await updateOne(
    'ticket',
    `id=eq.${encodeURIComponent(id)}`,
    { status }
  )

  if (!ticket) {
    return notFound(
      res,
      'Ticket não encontrado.'
    )
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

async function listUsers(
  req,
  res,
  actor
) {
  const rows = await supabaseRequest(
    '/usuario?select=id,nome,email,telefone,tipo,nivel_acesso,is_active,data_criacao,banido_em,banido_por,motivo_banimento,localizacao,bio&order=id.asc'
  )

  return ok(res, {
    users: (rows || []).map(row => ({
      id: Number(row.id),
      nome: row.nome || '',
      email: row.email || '',
      telefone: row.telefone || '',
      tipo: row.tipo || '',
      nivel_acesso: accessLevel(row),
      is_active: Boolean(
        row.is_active
      ),
      data_criacao:
        row.data_criacao,
      banido_em: row.banido_em,
      banido_por:
        row.banido_por == null
          ? null
          : Number(row.banido_por),
      motivo_banimento:
        row.motivo_banimento || '',
      localizacao:
        row.localizacao || '',
      bio: row.bio || '',
      can_ban: canBanUser(
        actor.user,
        row
      ),
    })),
    viewer_level: actor.level,
    viewer_id: Number(
      actor.user.id
    ),
  })
}

async function banUser(
  req,
  res,
  actor
) {
  const id = Number(req.query?.id)
  const body = readBody(req)
  const reason =
    cleanText(body.motivo) ||
    'Banimento administrativo'

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Usuário inválido.'
    )
  }

  const target = await selectOne(
    'usuario',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!target) {
    return notFound(
      res,
      'Usuário não encontrado.'
    )
  }

  if (
    Number(target.id) ===
    Number(actor.user.id)
  ) {
    return forbidden(
      res,
      'Você não pode banir a própria conta.'
    )
  }

  if (target.banido_em) {
    return badRequest(
      res,
      'Este usuário já está banido.'
    )
  }

  if (
    !canBanUser(
      actor.user,
      target
    )
  ) {
    return forbidden(
      res,
      actor.level === 'adm'
        ? 'Um ADM não pode banir outro ADM ou o CEO.'
        : 'Você não pode banir este usuário.'
    )
  }

  const now =
    new Date().toISOString()

  await updateOne(
    'usuario',
    `id=eq.${encodeURIComponent(id)}`,
    {
      is_active: false,
      banido_em: now,
      banido_por: Number(
        actor.user.id
      ),
      motivo_banimento: reason,
    }
  )

  // Remove os anúncios da vitrine sem apagar histórico de pedidos.
  await supabaseRequest(
    `/produto?vendedor_id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        ativo: false,
      }),
    }
  )

  // Também bane no Supabase Auth.
  // Mesmo se essa chamada falhar, requireUser bloqueia o acesso pelo banco.
  let authBanApplied = false

  if (target.auth_user_id) {
    try {
      await adminUpdateUser(
        target.auth_user_id,
        {
          ban_duration: '876000h',
        }
      )

      authBanApplied = true
    } catch (error) {
      console.error(
        '[QUÉX] Usuário desativado no banco, mas o ban do Supabase Auth falhou:',
        error
      )
    }
  }

  return ok(res, {
    ok: true,
    user_id: id,
    auth_ban_applied:
      authBanApplied,
  })
}

async function listClaims(req, res) {
  const rows = await supabaseRequest(
    '/reivindicacao_cpf?select=*&order=data_criacao.desc'
  )

  const adminIds = (rows || [])
    .map(row => row.decidida_por)

  const map = await usersMap(adminIds)

  return ok(res, {
    claims: (rows || []).map(row => ({
      id: Number(row.id),
      cpf: row.cpf || '',
      email: row.email || '',
      telefone: row.telefone || '',
      motivo: row.motivo || '',
      status: row.status,
      data_criacao:
        row.data_criacao,
      decisao_motivo:
        row.decisao_motivo || '',
      decidida_por:
        row.decidida_por == null
          ? null
          : Number(row.decidida_por),
      decidida_por_nome:
        map.get(
          Number(row.decidida_por)
        )?.nome || '',
      data_decisao:
        row.data_decisao,
      usuario_transferido_id:
        row.usuario_transferido_id ==
        null
          ? null
          : Number(
              row.usuario_transferido_id
            ),
    })),
  })
}

async function accountByCpf(cpf) {
  const buyer = await selectOne(
    'comprador',
    `cpf=eq.${encodeURIComponent(cpf)}`
  )

  if (buyer) {
    return selectOne(
      'usuario',
      `id=eq.${encodeURIComponent(buyer.id)}`
    )
  }

  const seller = await selectOne(
    'vendedor',
    `cpf_cnpj=eq.${encodeURIComponent(cpf)}`
  )

  if (seller) {
    return selectOne(
      'usuario',
      `id=eq.${encodeURIComponent(seller.id)}`
    )
  }

  return null
}

async function approveClaim(
  req,
  res,
  actor
) {
  const id = Number(req.query?.id)

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Reivindicação inválida.'
    )
  }

  const claim = await selectOne(
    'reivindicacao_cpf',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!claim) {
    return notFound(
      res,
      'Reivindicação não encontrada.'
    )
  }

  if (
    !['aberta', 'em_analise'].includes(
      claim.status
    )
  ) {
    return badRequest(
      res,
      'Esta reivindicação já foi decidida.'
    )
  }

  const target =
    await accountByCpf(claim.cpf)

  if (!target) {
    return notFound(
      res,
      'A conta vinculada a este CPF não foi encontrada.'
    )
  }

  if (target.banido_em) {
    return badRequest(
      res,
      'A conta vinculada a este CPF está banida e não pode ser transferida por este fluxo.'
    )
  }

  const sameEmail = await selectOne(
    'usuario',
    `email=eq.${encodeURIComponent(String(claim.email).toLowerCase())}`
  )

  if (
    sameEmail &&
    Number(sameEmail.id) !==
      Number(target.id)
  ) {
    return res
      .status(409)
      .json({
        error:
          'O e-mail informado na reivindicação já pertence a outra conta.',
      })
  }

  const oldEmail = target.email
  const oldPhone = target.telefone

  // Se já existe identidade no Supabase Auth, transfere o e-mail lá também.
  if (target.auth_user_id) {
    await adminUpdateUser(
      target.auth_user_id,
      {
        email: String(
          claim.email
        ).toLowerCase(),
        email_confirm: true,
      }
    )
  }

  try {
    await updateOne(
      'usuario',
      `id=eq.${encodeURIComponent(target.id)}`,
      {
        email: String(
          claim.email
        ).toLowerCase(),
        telefone: claim.telefone,
        is_active: true,
      }
    )
  } catch (error) {
    // Melhor esforço para desfazer a alteração do Auth se o banco falhar.
    if (target.auth_user_id) {
      await adminUpdateUser(
        target.auth_user_id,
        {
          email: oldEmail,
          email_confirm: true,
        }
      ).catch(() => {})
    }

    throw error
  }

  const updatedClaim = await updateOne(
    'reivindicacao_cpf',
    `id=eq.${encodeURIComponent(id)}`,
    {
      status: 'aprovada',
      decisao_motivo:
        'Reivindicação aprovada pela administração.',
      decidida_por: Number(
        actor.user.id
      ),
      data_decisao:
        new Date().toISOString(),
      usuario_transferido_id:
        Number(target.id),
    }
  )

  return ok(res, {
    claim: updatedClaim,
    transferred_user: {
      id: Number(target.id),
      old_email: oldEmail,
      new_email:
        String(claim.email).toLowerCase(),
      old_phone: oldPhone || '',
      new_phone:
        claim.telefone || '',
    },
  })
}

async function rejectClaim(
  req,
  res,
  actor
) {
  const id = Number(req.query?.id)
  const body = readBody(req)
  const reason =
    cleanText(body.motivo) ||
    'Reivindicação rejeitada pela administração.'

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return badRequest(
      res,
      'Reivindicação inválida.'
    )
  }

  if (reason.length > 1000) {
    return badRequest(
      res,
      'O motivo da rejeição pode ter no máximo 1000 caracteres.'
    )
  }

  const claim = await selectOne(
    'reivindicacao_cpf',
    `id=eq.${encodeURIComponent(id)}`
  )

  if (!claim) {
    return notFound(
      res,
      'Reivindicação não encontrada.'
    )
  }

  if (
    !['aberta', 'em_analise'].includes(
      claim.status
    )
  ) {
    return badRequest(
      res,
      'Esta reivindicação já foi decidida.'
    )
  }

  const updated = await updateOne(
    'reivindicacao_cpf',
    `id=eq.${encodeURIComponent(id)}`,
    {
      status: 'recusada',
      decisao_motivo: reason,
      decidida_por: Number(
        actor.user.id
      ),
      data_decisao:
        new Date().toISOString(),
    }
  )

  return ok(res, {
    claim: updated,
  })
}

export default async function handler(
  req,
  res
) {
  try {
    const actor =
      await getActor(req, res)

    if (!actor) return

    const resource =
      String(
        req.query?.resource || ''
      ).toLowerCase()

    if (
      resource === 'tickets' &&
      req.method === 'GET'
    ) {
      return listTickets(
        req,
        res,
        actor
      )
    }

    if (
      resource === 'ticket' &&
      req.method === 'GET'
    ) {
      return ticketDetail(req, res)
    }

    if (
      resource === 'ticket_reply' &&
      req.method === 'POST'
    ) {
      return replyTicket(
        req,
        res,
        actor
      )
    }

    if (
      resource === 'ticket_status' &&
      req.method === 'PUT'
    ) {
      return updateTicketStatus(
        req,
        res
      )
    }

    if (
      resource === 'users' &&
      req.method === 'GET'
    ) {
      return listUsers(
        req,
        res,
        actor
      )
    }

    if (
      resource === 'user_ban' &&
      req.method === 'POST'
    ) {
      return banUser(
        req,
        res,
        actor
      )
    }

    if (
      resource === 'claims' &&
      req.method === 'GET'
    ) {
      return listClaims(req, res)
    }

    if (
      resource === 'claim_approve' &&
      req.method === 'POST'
    ) {
      return approveClaim(
        req,
        res,
        actor
      )
    }

    if (
      resource === 'claim_reject' &&
      req.method === 'POST'
    ) {
      return rejectClaim(
        req,
        res,
        actor
      )
    }

    return methodNotAllowed(
      res,
      ['GET', 'POST', 'PUT']
    )
  } catch (error) {
    return serverError(
      res,
      error
    )
  }
}
