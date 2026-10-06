import { selectOne } from '../_lib/db.js'
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.',
    })
  }

  let authUserId = null

  try {
    const body = readBody(req)
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (name.length < 2) {
      return badRequest(res, 'Informe um nome válido.')
    }

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
          { error: error.message, code: error.code }
        )
      }
      throw error
    }

    if (
      await selectOne(
        'usuario',
        `email=eq.${encodeURIComponent(email)}`
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

    const redirectTo =
      String(body.redirect_to || '').trim() || undefined

    const authUser = await signUpWithEmail({
      email,
      password,
      data: {
        full_name: name,
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
      name,
      email,
      active: confirmed,
      profile,
    })

    return created(res, {
      pending_verification: !confirmed,
      email,
    })
  } catch (error) {
    if (authUserId) {
      await adminDeleteUser(authUserId).catch(() => {})
    }
    return serverError(res, error)
  }
}
