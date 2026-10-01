import crypto from 'node:crypto'
import { selectOne, updateOne } from '../_lib/db.js'
import { ok, readBody, serverError } from '../_lib/http.js'
import { SENHA_MARCADOR } from '../_lib/accounts.js'
import { adminCreateUser } from '../_lib/supabaseAuth.js'

// "Esqueci a senha" de uma conta ANTIGA que nunca logou depois da migração:
// ela ainda não existe no Supabase Auth, então o e-mail de recuperação não sairia.
// Aqui criamos a conta no Auth com senha aleatória (ninguém consegue logar com ela);
// só quem tem acesso ao e-mail consegue definir uma senha pelo link de recuperação.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const email = String(readBody(req).email || '').trim().toLowerCase()
    if (email) {
      const usuario = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}&auth_user_id=is.null`)
      if (usuario) {
        const authUser = await adminCreateUser({
          email,
          password: crypto.randomBytes(24).toString('base64url'),
          metadata: { full_name: usuario.nome, role: usuario.tipo === 'vendedor' ? 'seller' : 'buyer' },
        }).catch(() => null)
        if (authUser?.id) {
          await updateOne('usuario', `id=eq.${encodeURIComponent(usuario.id)}`, { auth_user_id: authUser.id, is_active: true, senha: SENHA_MARCADOR })
        }
      }
    }
    return ok(res, { ok: true }) // sempre 200: não revela se o e-mail existe
  } catch (error) {
    return serverError(res, error)
  }
}
