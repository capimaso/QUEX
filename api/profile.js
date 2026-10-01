import { selectOne, updateOne } from './_lib/db.js'
import { requireUser, publicUser } from './_lib/auth.js'
import { badRequest, ok, serverError, unauthorized } from './_lib/http.js'
import { validarCPF, validarCNPJ } from './_lib/documents.js'

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
      if (cpfCnpj.length === 11 ? !validarCPF(cpfCnpj) : cpfCnpj.length === 14 ? !validarCNPJ(cpfCnpj) : true) return badRequest(res, 'CPF ou CNPJ inválido. Confere os números.')
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
    if (!validarCPF(cpf)) return badRequest(res, 'CPF inválido. Confere os números.')
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
