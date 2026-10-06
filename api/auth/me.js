import {
  forbidden,
  ok,
  serverError,
  unauthorized,
} from '../_lib/http.js'
import {
  buildPublicUser,
  resolveAccount,
} from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método não permitido.',
    })
  }

  try {
    const account = await resolveAccount(req)
    if (!account) return unauthorized(res)

    const { authUser, usuario } = account
    const providers = authUser.app_metadata?.providers || []
    const extras = {
      has_password: providers.includes('email'),
    }

    if (!usuario) {
      const meta = authUser.user_metadata || {}

      return ok(res, {
        user: null,
        needs_profile: true,
        auth: {
          email: authUser.email,
          name: meta.full_name || meta.name || '',
        },
      })
    }

    if (usuario.banido_em) {
      return forbidden(
        res,
        'Esta conta foi desativada pela administração do QUÉX.'
      )
    }

    if (!usuario.is_active) {
      return unauthorized(
        res,
        'Conta inativa. Confirme seu e-mail.'
      )
    }

    return ok(res, {
      user: await buildPublicUser(usuario, extras),
      needs_profile: false,
    })
  } catch (error) {
    return serverError(res, error)
  }
}
