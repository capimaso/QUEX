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
import {
  insertOne,
  updateOne,
} from '../_lib/db.js'

async function notifyNewLogin(authUser, usuario) {
  const currentLogin = authUser?.last_sign_in_at

  if (!currentLogin || !usuario?.id) return

  const currentTime = new Date(currentLogin).getTime()
  const notifiedTime = usuario.ultimo_login_notificado_em
    ? new Date(usuario.ultimo_login_notificado_em).getTime()
    : 0

  if (
    !Number.isFinite(currentTime) ||
    currentTime <= notifiedTime
  ) {
    return
  }

  try {
    await insertOne('notificacao', {
      usuario_id: Number(usuario.id),
      tipo: 'novo_login',
      titulo: 'Novo login',
      mensagem: 'Um novo acesso à sua conta QUÉX foi identificado.',
      link: '/settings',
      lida: false,
    })

    await updateOne(
      'usuario',
      `id=eq.${encodeURIComponent(usuario.id)}`,
      {
        ultimo_login_notificado_em: currentLogin,
      }
    )
  } catch (error) {
    // Notificação nunca deve impedir o login.
    console.error(
      '[QUÉX] Não foi possível registrar a notificação de login:',
      error
    )
  }
}

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

    if (usuario.banido_em || usuario.excluido_em) {
      return forbidden(
        res,
        'Esta conta não está disponível.'
      )
    }

    if (!usuario.is_active) {
      return unauthorized(
        res,
        'Conta inativa. Confirme seu e-mail.'
      )
    }

    await notifyNewLogin(authUser, usuario)

    const freshUser = {
      ...usuario,
      ultimo_login_notificado_em:
        authUser.last_sign_in_at ||
        usuario.ultimo_login_notificado_em,
    }

    return ok(res, {
      user: await buildPublicUser(freshUser, extras),
      needs_profile: false,
    })
  } catch (error) {
    return serverError(res, error)
  }
}
