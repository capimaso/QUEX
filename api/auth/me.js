import { selectOne } from '../_lib/db.js'
import { unauthorized, ok, serverError } from '../_lib/http.js'
import { publicUser, requireUser } from '../_lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    let detail
    if (user.tipo === 'vendedor') {
      const seller = await selectOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`)
      detail = { cpf_cnpj: seller?.cpf_cnpj || '', business_name: seller?.comercial || '', localizacao: seller?.localizacao || '', entrega_propria: Boolean(seller?.entrega_propria) }
    } else {
      const buyer = await selectOne('comprador', `id=eq.${encodeURIComponent(user.id)}`)
      detail = { cpf: buyer?.cpf || '' }
    }
    return ok(res, { user: publicUser(user, detail || {}) })
  } catch (error) {
    return serverError(res, error)
  }
}
