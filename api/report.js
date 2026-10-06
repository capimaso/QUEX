import { insertOne, selectOne, updateOne } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import {
  badRequest,
  created,
  forbidden,
  methodNotAllowed,
  notFound,
  readBody,
  serverError,
  unauthorized,
} from './_lib/http.js'

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

async function sendReportEmail({ report, reporter, reportedUser, product }) {
  const apiKey = cleanText(process.env.RESEND_API_KEY)
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não está configurada na Vercel.')
  }

  const from = cleanText(process.env.RESEND_FROM_EMAIL) || DEFAULT_FROM
  const productLabel = product
    ? `#${product.id} — ${product.nome || 'Produto sem nome'}`
    : 'Não se aplica (denúncia de perfil)'

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
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>ID da denúncia</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">#${report.id}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Categoria</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(report.categoria)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Denunciante</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">
              #${reporter.id} — ${escapeHtml(reporter.nome || '')}
              ${reporter.email ? `<br /><span style="color:#6b7280">${escapeHtml(reporter.email)}</span>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Usuário denunciado</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">
              #${reportedUser.id} — ${escapeHtml(reportedUser.nome || '')}
              ${reportedUser.email ? `<br /><span style="color:#6b7280">${escapeHtml(reportedUser.email)}</span>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Produto</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(productLabel)}</td>
          </tr>
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb"><strong>Status</strong></td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(report.status || 'aberta')}</td>
          </tr>
        </tbody>
      </table>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
        <strong>Detalhes</strong>
        <div style="margin-top:8px">${description}</div>
      </div>

      <p style="margin-top:20px;font-size:12px;color:#9ca3af">
        Este e-mail foi gerado automaticamente pela API do QUÉX.
      </p>
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

    const error = new Error(`Falha ao enviar o e-mail de denúncia: ${message}`)
    error.status = response.status
    error.details = data
    throw error
  }

  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res, 'Faça login para enviar uma denúncia.')

    const body = readBody(req)
    const reporterId = Number(user.id)
    const receivedReporterId =
      body.denunciante_id === undefined || body.denunciante_id === null
        ? reporterId
        : Number(body.denunciante_id)

    const reportedUserId = Number(body.usuario_denunciado_id)
    const productId =
      body.produto_id === undefined || body.produto_id === null || body.produto_id === ''
        ? null
        : Number(body.produto_id)

    const category = cleanText(body.categoria)
    const description = cleanText(body.descricao)

    // O frontend envia denunciante_id porque faz parte do contrato da rota,
    // mas a API não confia nele: a identidade real vem da sessão autenticada.
    if (!Number.isInteger(receivedReporterId) || receivedReporterId !== reporterId) {
      return forbidden(res, 'O denunciante não corresponde ao usuário autenticado.')
    }

    if (!Number.isInteger(reportedUserId) || reportedUserId <= 0) {
      return badRequest(res, 'Usuário denunciado inválido.')
    }

    if (reportedUserId === reporterId) {
      return badRequest(res, 'Você não pode denunciar o próprio perfil.')
    }

    if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
      return badRequest(res, 'Produto inválido.')
    }

    if (!CATEGORIES.has(category)) {
      return badRequest(res, 'Selecione uma categoria válida.')
    }

    if (description.length > 1000) {
      return badRequest(res, 'Os detalhes podem ter no máximo 1000 caracteres.')
    }

    const reportedUser = await selectOne(
      'usuario',
      `id=eq.${encodeURIComponent(reportedUserId)}`
    )
    if (!reportedUser) return notFound(res, 'Usuário denunciado não encontrado.')

    let product = null
    if (productId !== null) {
      product = await selectOne('produto', `id=eq.${encodeURIComponent(productId)}`)
      if (!product) return notFound(res, 'Produto denunciado não encontrado.')

      if (Number(product.vendedor_id) !== reportedUserId) {
        return badRequest(
          res,
          'O produto informado não pertence ao usuário denunciado.'
        )
      }
    }

    const report = await insertOne('denuncia', {
      denunciante_id: reporterId,
      usuario_denunciado_id: reportedUserId,
      produto_id: productId,
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

      try {
        await updateOne(
          'denuncia',
          `id=eq.${encodeURIComponent(report.id)}`,
          { email_enviado_em: new Date().toISOString() }
        )
      } catch (error) {
        console.error(
          '[QUÉX] E-mail enviado, mas não foi possível atualizar email_enviado_em:',
          error
        )
      }
    } catch (error) {
      // A denúncia não é perdida se o serviço de e-mail estiver fora do ar
      // ou ainda não estiver configurado.
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
        produto_id: report.produto_id == null ? null : Number(report.produto_id),
        usuario_denunciado_id: Number(report.usuario_denunciado_id),
      },
      email_sent: emailSent,
    })
  } catch (error) {
    return serverError(res, error)
  }
}
