import {
  selectOne,
  supabaseRequest,
} from '../_lib/db.js'
import {
  badRequest,
  created,
  json,
  readBody,
  serverError,
} from '../_lib/http.js'
import {
  createAccount,
  documentInUse,
  validateProfile,
  verifyProfileAddress,
} from '../_lib/accounts.js'
import {
  adminDeleteUser,
  signUpWithEmail,
} from '../_lib/supabaseAuth.js'
import { ViaCepError } from '../_lib/viacep.js'
import {
  DocumentVerificationError,
  verifyDocument,
} from '../_lib/brasilApi.js'

const clean = value => String(value ?? '').trim()
const round2 = value =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100

async function documentPreview(req, res) {
  const body = readBody(req)
  const document = clean(body.document)

  try {
    const result = await verifyDocument({ document })

    return json(res, 200, {
      kind: result.kind,
      verified: Boolean(result.verified),
      pending: Boolean(result.pending),
      official_name: result.officialName || '',
      legal_name: result.legalName || '',
      trade_name: result.tradeName || '',
      warning: result.warning || null,
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
}

async function freightAverage(_req, res) {
  const rows = await supabaseRequest(
    '/vendedor?select=valor_por_km&valor_por_km=gt.0&entrega_disponivel=eq.true'
  )

  const values = (rows || [])
    .map(row => Number(row.valor_por_km))
    .filter(value => Number.isFinite(value) && value > 0)

  const quantidade = values.length
  const media =
    quantidade >= 10
      ? round2(
          values.reduce((sum, value) => sum + value, 0) /
            quantidade
        )
      : null

  return json(res, 200, {
    media,
    quantidade,
  })
}

export default async function handler(req, res) {
  const resource = clean(req.query?.resource).toLowerCase()

  try {
    if (resource === 'document') {
      if (req.method !== 'POST') {
        return res.status(405).json({
          error: 'Método não permitido.',
        })
      }

      return documentPreview(req, res)
    }

    if (resource === 'freight_average') {
      if (req.method !== 'GET') {
        return res.status(405).json({
          error: 'Método não permitido.',
        })
      }

      return freightAverage(req, res)
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Método não permitido.',
      })
    }

    let authUserId = null

    try {
      const body = readBody(req)

      /*
        BUG 1: o nome não é mais aceito como fonte de verdade do cadastro.
        Um cliente antigo que ainda tente enviar "name" recebe erro claro,
        evitando que o backend grave um nome arbitrário.
      */
      if (
        Object.prototype.hasOwnProperty.call(body, 'name') ||
        Object.prototype.hasOwnProperty.call(body, 'nome')
      ) {
        return badRequest(
          res,
          'O nome é obtido automaticamente pela validação do CPF/CNPJ.'
        )
      }

      const email = clean(body.email).toLowerCase()
      const password = String(body.password || '')

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return badRequest(res, 'Informe um e-mail válido.')
      }

      if (password.length < 6) {
        return badRequest(res, 'A senha deve ter no mínimo 6 caracteres.')
      }

      const parsed = validateProfile(body)
      if (parsed.error) return badRequest(res, parsed.error)

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

      if (
        await selectOne(
          'usuario',
          `email=eq.${encodeURIComponent(email)}&excluido_em=is.null`
        )
      ) {
        return badRequest(
          res,
          'Este e-mail já está cadastrado. Tenta entrar ou recuperar a senha.'
        )
      }

      const inUse = await documentInUse(profile)

      if (inUse) {
        const documentKind =
          profile.role === 'buyer' ||
          profile.cpfCnpj?.length === 11
            ? 'cpf'
            : 'cnpj'

        return json(res, 409, {
          error: inUse,
          code: 'document_in_use',
          document_kind: documentKind,
        })
      }

      const document =
        profile.role === 'buyer'
          ? profile.cpf
          : profile.cpfCnpj

      let documentVerification

      try {
        /*
          A pré-validação da tela NÃO é confiada.
          O backend consulta o provedor novamente no momento do cadastro.
        */
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

      const authFullName =
        documentVerification.kind === 'cpf'
          ? documentVerification.officialName || ''
          : (
              profile.businessName ||
              documentVerification.tradeName ||
              documentVerification.legalName ||
              ''
            )

      const redirectTo =
        clean(body.redirect_to) || undefined

      const authUser = await signUpWithEmail({
        email,
        password,
        data: {
          full_name: authFullName,
          role: profile.role,
        },
        redirectTo,
      })

      authUserId = authUser?.id

      if (!authUserId) {
        throw new Error('O Supabase não retornou o usuário criado.')
      }

      if (
        Array.isArray(authUser.identities) &&
        authUser.identities.length === 0
      ) {
        authUserId = null
        return badRequest(
          res,
          'Este e-mail já está cadastrado. Tenta entrar ou recuperar a senha.'
        )
      }

      const confirmed = Boolean(authUser.email_confirmed_at)

      await createAccount({
        authUserId,
        email,
        active: confirmed,
        profile,
        documentVerification,
      })

      return created(res, {
        pending_verification: !confirmed,
        document_verification_pending: Boolean(
          documentVerification.pending
        ),
        verification_warning:
          documentVerification.warning || null,
        email,
      })
    } catch (error) {
      if (authUserId) {
        await adminDeleteUser(authUserId).catch(() => {})
      }

      throw error
    }
  } catch (error) {
    return serverError(res, error)
  }
}
