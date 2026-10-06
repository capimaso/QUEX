import crypto from 'node:crypto'
import {
  selectOne,
  updateOne,
} from '../_lib/db.js'
import {
  badRequest,
  json,
  ok,
  readBody,
  serverError,
  unauthorized,
} from '../_lib/http.js'
import {
  verifyPassword,
} from '../_lib/password.js'
import {
  SENHA_MARCADOR,
} from '../_lib/accounts.js'
import {
  adminCreateUser,
} from '../_lib/supabaseAuth.js'

const metadataOf = usuario => ({
  full_name: usuario.nome,
  role:
    usuario.tipo === 'vendedor'
      ? 'seller'
      : 'buyer',
})

const randomPassword = () =>
  crypto
    .randomBytes(24)
    .toString('base64url')

async function link(
  usuario,
  authUser
) {
  if (usuario.banido_em) {
    throw new Error(
      'Esta conta foi desativada pela administração do QUÉX.'
    )
  }

  await updateOne(
    'usuario',
    `id=eq.${encodeURIComponent(usuario.id)}`,
    {
      auth_user_id: authUser.id,
      is_active: true,
      senha: SENHA_MARCADOR,
    }
  )
}

async function legacyLogin(
  res,
  body
) {
  const email = String(
    body.email || ''
  )
    .trim()
    .toLowerCase()

  const password = String(
    body.password || ''
  )

  if (!email || !password) {
    return badRequest(
      res,
      'Informe e-mail e senha.'
    )
  }

  const usuario = await selectOne(
    'usuario',
    `email=eq.${encodeURIComponent(email)}&banido_em=is.null`
  )

  if (
    !usuario ||
    usuario.auth_user_id ||
    !usuario.senha ||
    usuario.senha ===
      SENHA_MARCADOR
  ) {
    return unauthorized(
      res,
      'E-mail ou senha inválidos.'
    )
  }

  if (
    !verifyPassword(
      password,
      usuario.senha
    )
  ) {
    return unauthorized(
      res,
      'E-mail ou senha inválidos.'
    )
  }

  let authUser
  let precisaRedefinir = false

  try {
    authUser =
      await adminCreateUser({
        email,
        password,
        metadata:
          metadataOf(usuario),
      })
  } catch (error) {
    if (
      error.code !==
      'weak_password'
    ) {
      throw error
    }

    authUser =
      await adminCreateUser({
        email,
        password:
          randomPassword(),
        metadata:
          metadataOf(usuario),
      })

    precisaRedefinir = true
  }

  await link(
    usuario,
    authUser
  )

  if (precisaRedefinir) {
    return json(res, 409, {
      error:
        'Atualizamos o login do QUÉX. Clica em "Esqueci minha senha" pra criar uma nova senha.',
    })
  }

  return ok(res, {
    migrated: true,
  })
}

async function legacyReset(
  res,
  body
) {
  const email = String(
    body.email || ''
  )
    .trim()
    .toLowerCase()

  if (email) {
    const usuario =
      await selectOne(
        'usuario',
        `email=eq.${encodeURIComponent(email)}&auth_user_id=is.null&banido_em=is.null`
      )

    if (usuario) {
      const authUser =
        await adminCreateUser({
          email,
          password:
            randomPassword(),
          metadata:
            metadataOf(usuario),
        }).catch(() => null)

      if (authUser?.id) {
        await link(
          usuario,
          authUser
        )
      }
    }
  }

  return ok(res, {
    ok: true,
  })
}

export default async function handler(
  req,
  res
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error:
        'Método não permitido.',
    })
  }

  try {
    const body = readBody(req)

    return body.action === 'reset'
      ? await legacyReset(
          res,
          body
        )
      : await legacyLogin(
          res,
          body
        )
  } catch (error) {
    return serverError(
      res,
      error
    )
  }
}
