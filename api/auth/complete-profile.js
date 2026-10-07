import {
  badRequest,
  created,
  forbidden,
  json,
  ok,
  readBody,
  serverError,
  unauthorized,
} from '../_lib/http.js'
import {
  buildPublicUser,
  resolveAccount,
} from '../_lib/auth.js'
import {
  createAccount,
  documentInUse,
  validateProfile,
  verifyProfileAddress,
} from '../_lib/accounts.js'
import { ViaCepError } from '../_lib/viacep.js'
import {
  DocumentVerificationError,
  verifyDocument,
} from '../_lib/brasilApi.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.',
    })
  }

  try {
    const account = await resolveAccount(req)
    if (!account) return unauthorized(res)

    const { authUser, usuario } = account
    const extras = {
      has_password:
        (authUser.app_metadata?.providers || []).includes('email'),
    }

    if (usuario) {
      return ok(res, {
        user: await buildPublicUser(usuario, extras),
      })
    }

    if (!authUser.email_confirmed_at) {
      return forbidden(
        res,
        'Confirme seu e-mail antes de completar o cadastro.'
      )
    }

    const body = readBody(req)

    if (
      Object.prototype.hasOwnProperty.call(body, 'name') ||
      Object.prototype.hasOwnProperty.call(body, 'nome')
    ) {
      return badRequest(
        res,
        'O nome é obtido automaticamente pela validação do CPF/CNPJ.'
      )
    }

    const parsed = validateProfile(body)

    if (parsed.error) {
      return badRequest(res, parsed.error)
    }

    let profile

    try {
      profile = await verifyProfileAddress(parsed.value)
    } catch (error) {
      if (error instanceof ViaCepError) {
        return json(
          res,
          error.code === 'viacep_unavailable' ? 503 : 400,
          {
            error: error.message,
            code: error.code,
          }
        )
      }
      throw error
    }

    const inUse = await documentInUse(profile)
    if (inUse) return badRequest(res, inUse)

    const email = String(authUser.email || '').toLowerCase()

    const document =
      profile.role === 'buyer'
        ? profile.cpf
        : profile.cpfCnpj

    let documentVerification

    try {
      documentVerification = await verifyDocument({
        document,
      })
    } catch (error) {
      if (error instanceof DocumentVerificationError) {
        return json(res, error.status || 400, {
          error: error.message,
          code: error.code,
        })
      }
      throw error
    }

    if (
      documentVerification.kind === 'cnpj' &&
      !documentVerification.pending &&
      !documentVerification.legalName
    ) {
      return badRequest(
        res,
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'
      )
    }

    if (
      documentVerification.kind === 'cpf' &&
      !documentVerification.pending &&
      !documentVerification.officialName
    ) {
      return badRequest(
        res,
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'
      )
    }

    const novo = await createAccount({
      authUserId: authUser.id,
      email,
      active: true,
      profile,
      documentVerification,
    })

    return created(res, {
      user: await buildPublicUser(novo, extras),
      document_verification_pending: Boolean(
        documentVerification.pending
      ),
      verification_warning:
        documentVerification.warning || null,
    })
  } catch (error) {
    return serverError(res, error)
  }
}
