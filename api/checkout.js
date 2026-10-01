import { supabaseRpc } from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import { badRequest, forbidden, ok, serverError, unauthorized } from './_lib/http.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    if (user.tipo !== 'comprador') return forbidden(res, 'Somente compradores podem finalizar pedidos.')
    const address = String(req.body?.address || '').trim()
    const paymentMethod = String(req.body?.payment_method || 'pix').trim().toLowerCase()
    if (address.length < 8) return badRequest(res, 'Informe um endereço de entrega completo.')
    if (!['pix', 'cartao', 'dinheiro'].includes(paymentMethod)) return badRequest(res, 'Forma de pagamento inválida.')
    const result = await supabaseRpc('quex_finalizar_checkout', {
      p_comprador_id: Number(user.id),
      p_endereco_destino: address,
      p_forma_pagamento: paymentMethod,
    })
    return ok(res, { order: Array.isArray(result) ? result[0] : result })
  } catch (error) {
    const message = String(error.message || '')
    if (message.includes('quex_finalizar_checkout')) return serverError(res, new Error('A função de checkout ainda não foi instalada no Supabase. Execute supabase/app.sql uma vez no SQL Editor.'))
    return serverError(res, error)
  }
}
