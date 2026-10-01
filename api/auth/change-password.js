import { selectOne, updateOne } from '../_lib/db.js'
import { badRequest, ok, serverError, unauthorized } from '../_lib/http.js'
import { requireUser } from '../_lib/auth.js'
import { hashPassword, verifyPassword } from '../_lib/password.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    const current = String(req.body?.current_password || '')
    const next = String(req.body?.new_password || '')
    const fresh = await selectOne('usuario', `id=eq.${encodeURIComponent(user.id)}`)
    if (!verifyPassword(current, fresh?.senha)) return badRequest(res, 'A senha atual está incorreta.')
    if (next.length < 6) return badRequest(res, 'A nova senha deve ter no mínimo 6 caracteres.')
    await updateOne('usuario', `id=eq.${encodeURIComponent(user.id)}`, { senha: hashPassword(next) })
    return ok(res, { ok: true })
  } catch (error) {
    return serverError(res, error)
  }
}
