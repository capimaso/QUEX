import { selectOne, updateOne } from './_lib/db.js'
import { requireUser, publicUser } from './_lib/auth.js'
import { badRequest, ok, serverError, unauthorized } from './_lib/http.js'

const clean = value => String(value ?? '').trim()
const digits = value => clean(value).replace(/\D/g, '')

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    const body = req.body || {}
    const name = clean(body.name)
    const phone = clean(body.phone)
    if (name.length < 2) return badRequest(res, 'Informe um nome válido.')
    if (digits(phone).length < 10) return badRequest(res, 'Informe um telefone válido.')

    if (user.tipo === 'vendedor') {
      const seller = await selectOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`)
      const cpfCnpj = body.cpf_cnpj !== undefined ? digits(body.cpf_cnpj) : digits(seller?.cpf_cnpj || '')
      const businessName = body.business_name !== undefined ? clean(body.business_name) : seller?.comercial || ''
      if (![11, 14].includes(digits(cpfCnpj).length)) return badRequest(res, 'Informe um CPF ou CNPJ válido.')
      if (!businessName) return badRequest(res, 'Informe o estabelecimento ou nome da pessoa.')
      const duplicate = await selectOne('vendedor', `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}&id=neq.${encodeURIComponent(user.id)}`)
      if (duplicate) return badRequest(res, 'Este CPF/CNPJ já está cadastrado em outro vendedor.')
      await updateOne('usuario', `id=eq.${encodeURIComponent(user.id)}`, { nome: name, telefone: phone, endereco: body.address !== undefined ? clean(body.address) : user.endereco || '' })
      await updateOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`, {
        cpf_cnpj: cpfCnpj,
        comercial: businessName,
        localizacao: body.localizacao !== undefined ? clean(body.localizacao) : seller?.localizacao || '',
        entrega_propria: body.entrega_propria !== undefined ? Boolean(body.entrega_propria) : Boolean(seller?.entrega_propria),
      })
      const freshUser = await selectOne('usuario', `id=eq.${encodeURIComponent(user.id)}`)
      const freshSeller = await selectOne('vendedor', `id=eq.${encodeURIComponent(user.id)}`)
      return ok(res, { user: publicUser(freshUser, { cpf_cnpj: freshSeller.cpf_cnpj, business_name: freshSeller.comercial, localizacao: freshSeller.localizacao || '', entrega_propria: Boolean(freshSeller.entrega_propria) }) })
    }

    const currentBuyer = await selectOne('comprador', `id=eq.${encodeURIComponent(user.id)}`)
    const cpf = body.cpf !== undefined ? digits(body.cpf) : currentBuyer?.cpf || ''
    if (cpf.length !== 11) return badRequest(res, 'Informe um CPF válido.')
    const duplicate = await selectOne('comprador', `cpf=eq.${encodeURIComponent(cpf)}&id=neq.${encodeURIComponent(user.id)}`)
    if (duplicate) return badRequest(res, 'Este CPF já está cadastrado em outro comprador.')
    await updateOne('usuario', `id=eq.${encodeURIComponent(user.id)}`, { nome: name, telefone: phone, endereco: body.address !== undefined ? clean(body.address) : user.endereco || '' })
    await updateOne('comprador', `id=eq.${encodeURIComponent(user.id)}`, { cpf })
    const freshUser = await selectOne('usuario', `id=eq.${encodeURIComponent(user.id)}`)
    return ok(res, { user: publicUser(freshUser, { cpf }) })
  } catch (error) {
    return serverError(res, error)
  }
}
