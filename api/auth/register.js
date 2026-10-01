import { insertOne, selectOne, deleteWhere } from '../_lib/db.js'
import { badRequest, created, readBody, serverError } from '../_lib/http.js'
import { publicUser, setSessionCookie, signToken } from '../_lib/auth.js'
import { hashPassword } from '../_lib/password.js'

const digits = value => String(value || '').replace(/\D/g, '')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const body = readBody(req)
    const role = body.role === 'seller' ? 'seller' : 'buyer'
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const phone = String(body.phone || '').trim()
    const cpf = digits(body.cpf)
    const cpfCnpj = digits(body.cpf_cnpj)
    const businessName = String(body.business_name || '').trim()

    if (name.length < 2) return badRequest(res, 'Informe um nome válido.')
    if (!email || !email.includes('@')) return badRequest(res, 'Informe um e-mail válido.')
    if (password.length < 6) return badRequest(res, 'A senha deve ter no mínimo 6 caracteres.')
    if (digits(phone).length < 10) return badRequest(res, 'Informe um número de telefone válido.')
    if (role === 'buyer' && cpf.length !== 11) return badRequest(res, 'Informe um CPF válido com 11 dígitos.')
    if (role === 'seller' && ![11, 14].includes(digits(cpfCnpj).length)) return badRequest(res, 'Informe um CPF ou CNPJ válido.')
    if (role === 'seller' && !businessName) return badRequest(res, 'Informe o nome do estabelecimento ou da pessoa.')

    const existingEmail = await selectOne('usuario', `email=eq.${encodeURIComponent(email)}`)
    if (existingEmail) return badRequest(res, 'Este e-mail já está cadastrado.')

    if (role === 'buyer') {
      const existingCpf = await selectOne('comprador', `cpf=eq.${encodeURIComponent(cpf)}`)
      if (existingCpf) return badRequest(res, 'Este CPF já está cadastrado.')
    } else {
      const existingCpfCnpj = await selectOne('vendedor', `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}`)
      if (existingCpfCnpj) return badRequest(res, 'Este CPF/CNPJ já está cadastrado.')
    }

    const user = await insertOne('usuario', {
      nome: name,
      email,
      senha: hashPassword(password),
      telefone: phone,
      endereco: '',
      tipo: role === 'seller' ? 'vendedor' : 'comprador',
    })

    try {
      if (role === 'buyer') {
        await insertOne('comprador', { id: user.id, cpf })
      } else {
        await insertOne('vendedor', {
          id: user.id,
          comercial: businessName,
          entrega_propria: false,
          cpf_cnpj: cpfCnpj,
          localizacao: '',
        })
      }
    } catch (error) {
      await deleteWhere('usuario', `id=eq.${encodeURIComponent(user.id)}`).catch(() => {})
      throw error
    }

    const result = publicUser(user, role === 'seller'
      ? { cpf_cnpj: cpfCnpj, business_name: businessName, localizacao: '', entrega_propria: false }
      : { cpf })
    const token = signToken({ id: Number(user.id), type: user.tipo })
    setSessionCookie(res, token)
    return created(res, { user: result })
  } catch (error) {
    return serverError(res, error)
  }
}
