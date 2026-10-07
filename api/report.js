import {
  insertOne,
  selectOne,
  supabaseRequest,
  updateOne,
} from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { resolveAdmin } from './_lib/admin.js'
import {
  badRequest,
  created,
  forbidden,
  json,
  methodNotAllowed,
  notFound,
  ok,
  readBody,
  serverError,
  unauthorized,
} from './_lib/http.js'
import {
  antiContact,
  CONTACT_WARNING,
} from './_lib/antiContact.js'

const REPORT_TO = 'denuncias.quex@proton.me'
const DEFAULT_FROM = 'QUÉX <onboarding@resend.dev>'

const CATEGORIES = new Set([
  'anuncio_enganoso',
  'perfil_improprio',
  'preco_abusivo_fraude',
  'conteudo_ofensivo',
  'outros',
])

const cleanText = value => String(value ?? '').trim()

function escapeHtml(value) {
  return cleanText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function productIsRetained(product) {
  if (!product) return false

  return Boolean(
    product.retido === true ||
    product.retido_em ||
    product.status_moderacao === 'retido' ||
    product.status_moderacao === 'retida'
  )
}

async function sendReportEmail({
  report,
  reporter,
  reportedUser,
  product,
}) {
  const apiKey = cleanText(process.env.RESEND_API_KEY)

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não está configurada na Vercel.')
  }

  const from =
    cleanText(process.env.RESEND_FROM_EMAIL) || DEFAULT_FROM

  const productLabel = product
    ? `#${product.id} — ${product.nome || 'Produto sem nome'}`
    : 'Não se aplica'

  const messageLabel =
    report.mensagem_id == null
      ? 'Não se aplica'
      : `Mensagem privada #${report.mensagem_id}`

  const description = report.descricao
    ? escapeHtml(report.descricao).replaceAll('\n', '<br />')
    : '<em>Sem detalhes adicionais.</em>'

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:680px;margin:0 auto">
      <h2 style="color:#0D1273;margin-bottom:8px">Nova denúncia no QUÉX</h2>
      <p style="margin-top:0;color:#6b7280">Uma nova denúncia foi registrada e precisa de revisão.</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tbody>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>ID</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">#${report.id}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Categoria</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(report.categoria)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Denunciante</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">#${reporter.id} — ${escapeHtml(reporter.nome || '')}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Usuário denunciado</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">#${reportedUser.id} — ${escapeHtml(reportedUser.nome || '')}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Produto</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(productLabel)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Mensagem</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(messageLabel)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
        <strong>Detalhes</strong>
        <div style="margin-top:8px">${description}</div>
      </div>
    </div>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `quex-report-${report.id}`,
    },
    body: JSON.stringify({
      from,
      to: [REPORT_TO],
      subject: `[QUÉX] Nova denúncia #${report.id} — ${report.categoria}`,
      html,
    }),
  })

  const text = await response.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text || null
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      (typeof data === 'string' ? data : '') ||
      `Resend HTTP ${response.status}`

    const error = new Error(
      `Falha ao enviar o e-mail de denúncia: ${message}`
    )

    error.status = response.status
    error.details = data
    throw error
  }

  return data
}

async function listQuestions(req, res) {
  const productId = Number(req.query?.id)

  if (!Number.isInteger(productId) || productId <= 0) {
    return badRequest(res, 'Produto inválido.')
  }

  const product = await selectOne(
    'produto',
    `id=eq.${encodeURIComponent(productId)}`
  )

  if (!product) {
    return notFound(res, 'Produto não encontrado.')
  }

  const questions = await supabaseRequest(
    `/pergunta_produto?select=id,produto_id,usuario_id,pergunta,data_criacao&produto_id=eq.${encodeURIComponent(productId)}&status=eq.ativa&bloqueada=eq.false&order=data_criacao.desc`
  )

  const questionIds = (questions || []).map(row => Number(row.id))

  const answers = questionIds.length
    ? await supabaseRequest(
        `/resposta_produto?select=id,pergunta_id,vendedor_id,resposta,data_criacao&pergunta_id=in.(${questionIds.join(',')})&bloqueada=eq.false&removida_em=is.null&order=data_criacao.asc`
      )
    : []

  const sellerIds = [
    ...new Set((answers || []).map(row => Number(row.vendedor_id))),
  ]

  const sellers = sellerIds.length
    ? await supabaseRequest(
        `/vendedor?select=id,comercial&id=in.(${sellerIds.join(',')})`
      )
    : []

  const users = sellerIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome&id=in.(${sellerIds.join(',')})`
      )
    : []

  const sellerMap = new Map(
    (sellers || []).map(row => [Number(row.id), row])
  )

  const userMap = new Map(
    (users || []).map(row => [Number(row.id), row])
  )

  const answerMap = new Map()

  for (const answer of answers || []) {
    if (!answerMap.has(Number(answer.pergunta_id))) {
      const sellerId = Number(answer.vendedor_id)

      answerMap.set(Number(answer.pergunta_id), {
        id: Number(answer.id),
        seller_id: sellerId,
        seller_name:
          sellerMap.get(sellerId)?.comercial ||
          userMap.get(sellerId)?.nome ||
          'Vendedor',
        text: answer.resposta,
        created_at: answer.data_criacao,
      })
    }
  }

  return ok(res, {
    product: {
      id: productId,
      seller_id: Number(product.vendedor_id),
    },
    questions: (questions || []).map(row => ({
      id: Number(row.id),
      product_id: Number(row.produto_id),
      author_id: Number(row.usuario_id),
      author_name: 'Anônimo',
      text: row.pergunta,
      created_at: row.data_criacao,
      answer: answerMap.get(Number(row.id)) || null,
    })),
  })
}

async function createQuestion(req, res) {
  const user = await requireUser(req)

  if (!user) {
    return unauthorized(res, 'Faça login para fazer uma pergunta.')
  }

  const productId = Number(req.query?.id)
  const body = readBody(req)
  const question = cleanText(body.pergunta)

  if (!Number.isInteger(productId) || productId <= 0) {
    return badRequest(res, 'Produto inválido.')
  }

  if (question.length < 1 || question.length > 500) {
    return badRequest(
      res,
      'A pergunta deve ter entre 1 e 500 caracteres.'
    )
  }

  const product = await selectOne(
    'produto',
    `id=eq.${encodeURIComponent(productId)}`
  )

  if (!product) {
    return notFound(res, 'Produto não encontrado.')
  }

  if (productIsRetained(product)) {
    return forbidden(
      res,
      'Este anúncio está retido e não aceita novas perguntas.'
    )
  }

  const filter = antiContact(question)

  const row = await insertOne('pergunta_produto', {
    produto_id: productId,
    usuario_id: Number(user.id),
    pergunta: question,
    status: filter.bloqueado ? 'oculta' : 'ativa',
    bloqueada: filter.bloqueado,
    motivo_bloqueio: filter.motivo,
  })

  if (filter.bloqueado) {
    return badRequest(res, CONTACT_WARNING)
  }

  return created(res, {
    question: {
      id: Number(row.id),
      product_id: productId,
      author_id: Number(user.id),
      author_name: 'Anônimo',
      text: row.pergunta,
      created_at: row.data_criacao,
      answer: null,
    },
  })
}

async function answerQuestion(req, res) {
  const user = await requireUser(req)

  if (!user) {
    return unauthorized(res, 'Faça login para responder.')
  }

  const questionId = Number(req.query?.question_id)
  const body = readBody(req)
  const answer = cleanText(body.resposta)

  if (!Number.isInteger(questionId) || questionId <= 0) {
    return badRequest(res, 'Pergunta inválida.')
  }

  if (answer.length < 1 || answer.length > 500) {
    return badRequest(
      res,
      'A resposta deve ter entre 1 e 500 caracteres.'
    )
  }

  const question = await selectOne(
    'pergunta_produto',
    `id=eq.${encodeURIComponent(questionId)}`
  )

  if (
    !question ||
    question.status !== 'ativa' ||
    question.bloqueada
  ) {
    return notFound(res, 'Pergunta não encontrada.')
  }

  const product = await selectOne(
    'produto',
    `id=eq.${encodeURIComponent(question.produto_id)}`
  )

  if (!product) {
    return notFound(res, 'Produto não encontrado.')
  }

  if (
    user.tipo !== 'vendedor' ||
    Number(product.vendedor_id) !== Number(user.id)
  ) {
    return forbidden(
      res,
      'Apenas o vendedor dono deste anúncio pode responder.'
    )
  }

  const existing = await selectOne(
    'resposta_produto',
    `pergunta_id=eq.${encodeURIComponent(questionId)}&bloqueada=eq.false&removida_em=is.null`
  )

  if (existing) {
    return json(res, 409, {
      error: 'Esta pergunta já possui uma resposta oficial.',
    })
  }

  const filter = antiContact(answer)

  const row = await insertOne('resposta_produto', {
    pergunta_id: questionId,
    vendedor_id: Number(user.id),
    resposta: answer,
    bloqueada: filter.bloqueado,
    motivo_bloqueio: filter.motivo,
  })

  if (filter.bloqueado) {
    return badRequest(res, CONTACT_WARNING)
  }

  const seller = await selectOne(
    'vendedor',
    `id=eq.${encodeURIComponent(user.id)}`
  )

  return created(res, {
    answer: {
      id: Number(row.id),
      question_id: questionId,
      seller_id: Number(user.id),
      seller_name: seller?.comercial || user.nome || 'Vendedor',
      text: row.resposta,
      created_at: row.data_criacao,
    },
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

async function listAdminReports(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const reports = await supabaseRequest(
    '/denuncia?select=*&order=data_criacao.desc'
  )

  const userIds = [
    ...new Set(
      (reports || [])
        .flatMap(row => [
          Number(row.denunciante_id),
          Number(row.usuario_denunciado_id),
        ])
        .filter(Boolean)
    ),
  ]

  const messageIds = [
    ...new Set(
      (reports || [])
        .map(row => Number(row.mensagem_id))
        .filter(Boolean)
    ),
  ]

  const productIds = [
    ...new Set(
      (reports || [])
        .map(row => Number(row.produto_id))
        .filter(Boolean)
    ),
  ]

  const users = userIds.length
    ? await supabaseRequest(
        `/usuario?select=id,nome,email&id=in.(${userIds.join(',')})`
      )
    : []

  const messages = messageIds.length
    ? await supabaseRequest(
        `/mensagem_chat?select=id,chat_id,remetente_id,mensagem,data_envio,removida_em,removida_por&id=in.(${messageIds.join(',')})`
      )
    : []

  const products = productIds.length
    ? await supabaseRequest(
        `/produto?select=id,nome&id=in.(${productIds.join(',')})`
      )
    : []

  const userMap = new Map(
    (users || []).map(row => [Number(row.id), row])
  )

  const messageMap = new Map(
    (messages || []).map(row => [Number(row.id), row])
  )

  const productMap = new Map(
    (products || []).map(row => [Number(row.id), row])
  )

  return ok(res, {
    reports: (reports || []).map(row => {
      const message =
        row.mensagem_id == null
          ? null
          : messageMap.get(Number(row.mensagem_id))

      return {
        id: Number(row.id),
        reporter_id: Number(row.denunciante_id),
        reporter_name:
          userMap.get(Number(row.denunciante_id))?.nome || 'Usuário',
        reported_user_id: Number(row.usuario_denunciado_id),
        reported_user_name:
          userMap.get(Number(row.usuario_denunciado_id))?.nome || 'Usuário',
        product_id:
          row.produto_id == null ? null : Number(row.produto_id),
        product_name:
          row.produto_id == null
            ? ''
            : productMap.get(Number(row.produto_id))?.nome || '',
        message_id:
          row.mensagem_id == null ? null : Number(row.mensagem_id),
        message_text: message?.mensagem || '',
        message_removed: Boolean(message?.removida_em),
        category: row.categoria,
        description: row.descricao || '',
        status: row.status,
        created_at: row.data_criacao,
      }
    }),
    viewer_level: actor.level,
  })
}

async function removeChatMessage(req, res) {
  const actor = await requireAdmin(req, res)
  if (!actor) return

  const messageId = Number(req.query?.message_id)

  if (!Number.isInteger(messageId) || messageId <= 0) {
    return badRequest(res, 'Mensagem inválida.')
  }

  const message = await selectOne(
    'mensagem_chat',
    `id=eq.${encodeURIComponent(messageId)}`
  )

  if (!message) {
    return notFound(res, 'Mensagem não encontrada.')
  }

  if (!message.removida_em) {
    await updateOne(
      'mensagem_chat',
      `id=eq.${encodeURIComponent(messageId)}`,
      {
        removida_em: new Date().toISOString(),
        removida_por: Number(actor.user.id),
      }
    )
  }

  return ok(res, {
    ok: true,
    message_id: messageId,
  })
}

async function validateQaReport({
  productId,
  reportedUserId,
  questionId,
  answerId,
}) {
  if (questionId != null) {
    const question = await selectOne(
      'pergunta_produto',
      `id=eq.${encodeURIComponent(questionId)}`
    )

    if (
      !question ||
      Number(question.produto_id) !== Number(productId) ||
      Number(question.usuario_id) !== Number(reportedUserId)
    ) {
      return false
    }

    return true
  }

  if (answerId != null) {
    const answer = await selectOne(
      'resposta_produto',
      `id=eq.${encodeURIComponent(answerId)}`
    )

    if (!answer || Number(answer.vendedor_id) !== Number(reportedUserId)) {
      return false
    }

    const question = await selectOne(
      'pergunta_produto',
      `id=eq.${encodeURIComponent(answer.pergunta_id)}`
    )

    return Boolean(
      question &&
      Number(question.produto_id) === Number(productId)
    )
  }

  return false
}

async function createReport(req, res) {
  const user = await requireUser(req)

  if (!user) {
    return unauthorized(res, 'Faça login para enviar uma denúncia.')
  }

  const body = readBody(req)
  const reporterId = Number(user.id)

  const receivedReporterId =
    body.denunciante_id === undefined ||
    body.denunciante_id === null
      ? reporterId
      : Number(body.denunciante_id)

  const reportedUserId = Number(body.usuario_denunciado_id)

  const productId =
    body.produto_id === undefined ||
    body.produto_id === null ||
    body.produto_id === ''
      ? null
      : Number(body.produto_id)

  const messageId =
    body.mensagem_id === undefined ||
    body.mensagem_id === null ||
    body.mensagem_id === ''
      ? null
      : Number(body.mensagem_id)

  const questionId =
    body.pergunta_id === undefined ||
    body.pergunta_id === null ||
    body.pergunta_id === ''
      ? null
      : Number(body.pergunta_id)

  const answerId =
    body.resposta_id === undefined ||
    body.resposta_id === null ||
    body.resposta_id === ''
      ? null
      : Number(body.resposta_id)

  const contextType = cleanText(body.contexto || 'produto').toLowerCase()
  const category = cleanText(body.categoria)
  const description = cleanText(body.descricao)

  if (
    !Number.isInteger(receivedReporterId) ||
    receivedReporterId !== reporterId
  ) {
    return forbidden(
      res,
      'O denunciante não corresponde ao usuário autenticado.'
    )
  }

  if (!Number.isInteger(reportedUserId) || reportedUserId <= 0) {
    return badRequest(res, 'Usuário denunciado inválido.')
  }

  if (reportedUserId === reporterId) {
    return badRequest(res, 'Você não pode denunciar a própria mensagem.')
  }

  if (
    productId !== null &&
    (!Number.isInteger(productId) || productId <= 0)
  ) {
    return badRequest(res, 'Produto inválido.')
  }

  if (
    messageId !== null &&
    (!Number.isInteger(messageId) || messageId <= 0)
  ) {
    return badRequest(res, 'Mensagem inválida.')
  }

  if (!CATEGORIES.has(category)) {
    return badRequest(res, 'Selecione uma categoria válida.')
  }

  if (description.length > 1000) {
    return badRequest(
      res,
      'Os detalhes podem ter no máximo 1000 caracteres.'
    )
  }

  const reportedUser = await selectOne(
    'usuario',
    `id=eq.${encodeURIComponent(reportedUserId)}`
  )

  if (!reportedUser) {
    return notFound(res, 'Usuário denunciado não encontrado.')
  }

  let product = null

  if (productId !== null) {
    product = await selectOne(
      'produto',
      `id=eq.${encodeURIComponent(productId)}`
    )

    if (!product) {
      return notFound(res, 'Produto denunciado não encontrado.')
    }

    if (contextType === 'qa') {
      const validQa = await validateQaReport({
        productId,
        reportedUserId,
        questionId,
        answerId,
      })

      if (!validQa) {
        return badRequest(
          res,
          'A mensagem de perguntas e respostas não corresponde aos dados informados.'
        )
      }
    } else if (Number(product.vendedor_id) !== reportedUserId) {
      return badRequest(
        res,
        'O produto informado não pertence ao usuário denunciado.'
      )
    }
  }

  if (messageId !== null) {
    const message = await selectOne(
      'mensagem_chat',
      `id=eq.${encodeURIComponent(messageId)}`
    )

    if (!message) {
      return notFound(res, 'Mensagem denunciada não encontrada.')
    }

    if (Number(message.remetente_id) !== reportedUserId) {
      return badRequest(
        res,
        'A mensagem não pertence ao usuário denunciado.'
      )
    }

    const chat = await selectOne(
      'chat',
      `id=eq.${encodeURIComponent(message.chat_id)}`
    )

    if (!chat) {
      return notFound(res, 'Chat da mensagem não encontrado.')
    }

    if (
      Number(chat.comprador_id) !== reporterId &&
      Number(chat.vendedor_id) !== reporterId
    ) {
      return forbidden(
        res,
        'Você não pode denunciar mensagens de um chat do qual não participa.'
      )
    }
  }

  const report = await insertOne('denuncia', {
    denunciante_id: reporterId,
    usuario_denunciado_id: reportedUserId,
    produto_id: productId,
    mensagem_id: messageId,
    categoria: category,
    descricao: description || null,
    status: 'aberta',
  })

  let emailSent = false

  try {
    await sendReportEmail({
      report,
      reporter: user,
      reportedUser,
      product,
    })

    emailSent = true

    await updateOne(
      'denuncia',
      `id=eq.${encodeURIComponent(report.id)}`,
      { email_enviado_em: new Date().toISOString() }
    ).catch(() => {})
  } catch (error) {
    console.error(
      `[QUÉX] Denúncia #${report.id} salva, mas o e-mail não foi enviado:`,
      error
    )
  }

  return created(res, {
    report: {
      id: Number(report.id),
      categoria: report.categoria,
      status: report.status || 'aberta',
      produto_id:
        report.produto_id == null
          ? null
          : Number(report.produto_id),
      mensagem_id:
        report.mensagem_id == null
          ? null
          : Number(report.mensagem_id),
      usuario_denunciado_id: Number(report.usuario_denunciado_id),
    },
    email_sent: emailSent,
  })
}

export default async function handler(req, res) {
  try {
    const resource = cleanText(req.query?.resource).toLowerCase()

    if (resource === 'questions' && req.method === 'GET') {
      return listQuestions(req, res)
    }

    if (resource === 'questions' && req.method === 'POST') {
      return createQuestion(req, res)
    }

    if (resource === 'answer' && req.method === 'POST') {
      return answerQuestion(req, res)
    }

    if (resource === 'admin_reports' && req.method === 'GET') {
      return listAdminReports(req, res)
    }

    if (
      resource === 'admin_remove_message' &&
      req.method === 'POST'
    ) {
      return removeChatMessage(req, res)
    }

    if (!resource && req.method === 'POST') {
      return createReport(req, res)
    }

    return methodNotAllowed(res, ['GET', 'POST'])
  } catch (error) {
    return serverError(res, error)
  }
}
