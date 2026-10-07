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
          { error: error.message, code: error.code }
        )
      }
      throw error
    }

    const inUse = await documentInUse(profile)
    if (inUse) return badRequest(res, inUse)

    const meta = authUser.user_metadata || {}
    const email = String(authUser.email || '').toLowerCase()
    const submittedName = String(
      body.name ||
      meta.full_name ||
      meta.name ||
      email.split('@')[0] ||
      'Usuário'
    )
      .trim()
      .slice(0, 100)

    const document =
      profile.role === 'buyer'
        ? profile.cpf
        : profile.cpfCnpj

    let documentVerification

    try {
      documentVerification = await verifyDocument({
        document,
        submittedName,
        businessName: profile.businessName,
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

    const accountName =
      documentVerification.kind === 'cpf'
        ? documentVerification.officialName || submittedName
        : documentVerification.tradeName || profile.businessName || submittedName

    const novo = await createAccount({
      authUserId: authUser.id,
      name: accountName,
      email,
      active: true,
      profile,
      documentVerification,
    })

    return created(res, {
      user: await buildPublicUser(novo, extras),
      document_verification_pending: Boolean(documentVerification.pending),
      verification_warning: documentVerification.warning || null,
    })
  } catch (error) {
    return serverError(res, error)
  }
}
