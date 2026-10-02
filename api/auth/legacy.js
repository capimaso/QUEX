import crypto from 'node:crypto'
import { selectOne, updateOne } from '../_lib/db.js'
import { badRequest, json, ok, readBody, serverError, unauthorized } from '../_lib/http.js'
import { verifyPassword } from '../_lib/password.js'
import { SENHA_MARCADOR } from '../_lib/accounts.js'
import { adminCreateUser } from '../_lib/supabaseAuth.js'

// Contas ANTIGAS (criadas antes do Supabase Auth, senha em usuario.senha).
// Um arquivo só pra economizar função serverless (a Vercel Hobby limita em 12).
//
//  POST { action: 'login', email, password }
//    Confere a senha antiga e cria a conta no Supabase Auth com a MESMA senha.
//    Depois o front entra normalmente pelo Supabase.
//
//  POST { action: 'reset', email }
//    "Esqueci a senha" de conta antiga que nunca logou: cria a conta no Auth com senha
//    aleatória (ninguém loga com ela); só quem tem o e-mail define senha pelo link.

const metadataOf = usuario => ({ full_name: usuario.nome, role: usuario.tipo === 'vendedor' ? 'seller' : 'buyer' })
const randomPassword = () => crypto.randomBytes(24).toString('base64url')

async function link(usuario, authUser) {
  await updateOne('usuario', `id=eq.${encodeURIComponent(usuario.id)}`, {
    auth_user_id: authUser.id,
    is_active: true,
    senha: SENHA_MARCADOR,
  })
}

async function legacyLogin(res, body) {
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email || !password) return badRequest(res, 'Informe e-mail e senha.')

  const usuario = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}`)
  if (!usuario || usuario.auth_user_id || !usuario.senha || usuario.senha === SENHA_MARCADOR) return unauthorized(res, 'E-mail ou senha inválidos.')
  if (!verifyPassword(password, usuario.senha)) return unauthorized(res, 'E-mail ou senha inválidos.')

  let authUser
  let precisaRedefinir = false
  try {
    authUser = await adminCreateUser({ email, password, metadata: metadataOf(usuario) })
  } catch (error) {
    if (error.code !== 'weak_password') throw error
    // Senha antiga curta demais pro Supabase: cria com senha aleatória e pede pra redefinir.
    authUser = await adminCreateUser({ email, password: randomPassword(), metadata: metadataOf(usuario) })
    precisaRedefinir = true
  }
  await link(usuario, authUser)
  if (precisaRedefinir) return json(res, 409, { error: 'Atualizamos o login do QUÉX. Clica em "Esqueci minha senha" pra criar uma nova senha.' })
  return ok(res, { migrated: true })
}

async function legacyReset(res, body) {
  const email = String(body.email || '').trim().toLowerCase()
  if (email) {
    const usuario = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}&auth_user_id=is.null`)
    if (usuario) {
      const authUser = await adminCreateUser({ email, password: randomPassword(), metadata: metadataOf(usuario) }).catch(() => null)
      if (authUser?.id) await link(usuario, authUser)
    }
  }
  return ok(res, { ok: true }) // sempre 200: não revela se o e-mail existe
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const body = readBody(req)
    return body.action === 'reset' ? await legacyReset(res, body) : await legacyLogin(res, body)
  } catch (error) {
    return serverError(res, error)
  }
}
