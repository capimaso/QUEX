import { selectOne, updateOne } from '../_lib/db.js'
import { badRequest, ok, readBody, serverError, unauthorized } from '../_lib/http.js'
import { publicUser, setSessionCookie, signToken } from '../_lib/auth.js'
import { hashPassword, verifyPassword } from '../_lib/password.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const body = readBody(req)
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    if (!email || !password) return badRequest(res, 'Informe e-mail e senha.')

    const user = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}`)
    if (!user || !['comprador', 'vendedor'].includes(user.tipo) || !verifyPassword(password, user.senha)) return unauthorized(res, 'E-mail ou senha inválidos.')

    if (user.senha && !user.senha.startsWith('scrypt$')) {
      await updateOne('usuario', `id=eq.${encodeURIComponent(user.id)}`, { senha: hashPassword(password) }).catch(() => {})
      user.senha = ''
    }

    let extras = {}
    if (user.tipo === 'vendedor') {
      const seller = await selectOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`)
      extras = {
        cpf_cnpj: seller?.cpf_cnpj || '',
        business_name: seller?.comercial || '',
        localizacao: seller?.localizacao || '',
        entrega_propria: Boolean(seller?.entrega_propria),
      }
    } else {
      const buyer = await selectOne('comprador', `id=eq.${encodeURIComponent(user.id)}`)
      extras = { cpf: buyer?.cpf || '' }
    }

    const result = publicUser(user, extras)
    setSessionCookie(res, signToken({ id: Number(user.id), type: user.tipo }))
    return ok(res, { user: result })
  } catch (error) {
    return serverError(res, error)
  }
}
