import crypto from 'node:crypto'
import { selectOne, updateOne } from '../_lib/db.js'
import { badRequest, ok, readBody, serverError, unauthorized, json } from '../_lib/http.js'
import { verifyPassword } from '../_lib/password.js'
import { SENHA_MARCADOR } from '../_lib/accounts.js'
import { adminCreateUser } from '../_lib/supabaseAuth.js'

// Migração "preguiçosa" das contas ANTIGAS (senha guardada em usuario.senha):
// no 1º login, confere a senha antiga e cria a conta no Supabase Auth com a mesma senha.
// Depois disso o front entra normalmente pelo Supabase.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const body = readBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!email || !password) return badRequest(res, 'Informe e-mail e senha.')

    const usuario = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}`)
    const invalido = () => unauthorized(res, 'E-mail ou senha inválidos.')
    if (!usuario || usuario.auth_user_id || !usuario.senha || usuario.senha === SENHA_MARCADOR) return invalido()
    if (!verifyPassword(password, usuario.senha)) return invalido()

    const metadata = { full_name: usuario.nome, role: usuario.tipo === 'vendedor' ? 'seller' : 'buyer' }
    let authUser
    let precisaRedefinir = false
    try {
      authUser = await adminCreateUser({ email, password, metadata })
    } catch (error) {
      if (error.code !== 'weak_password') throw error
      // Senha antiga curta demais pro Supabase: cria com senha aleatória e pede pra redefinir.
      authUser = await adminCreateUser({ email, password: crypto.randomBytes(24).toString('base64url'), metadata })
      precisaRedefinir = true
    }

    await updateOne('usuario', `id=eq.${encodeURIComponent(usuario.id)}`, {
      auth_user_id: authUser.id,
      is_active: true,
      senha: SENHA_MARCADOR,
    })
    if (precisaRedefinir) {
      return json(res, 409, { error: 'Atualizamos o login do QUÉX. Clica em "Esqueci minha senha" pra criar uma nova senha.' })
    }
    return ok(res, { migrated: true })
  } catch (error) {
    return serverError(res, error)
  }
}
