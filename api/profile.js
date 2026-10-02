import { selectOne, updateOne } from './_lib/db.js'
import { requireUser, buildPublicUser } from './_lib/auth.js'
import { badRequest, ok, serverError, unauthorized } from './_lib/http.js'
import { validarCPF, validarCNPJ } from './_lib/documents.js'
import { avatarExists, deleteAvatar, isValidAvatarPath } from './_lib/storage.js'

const clean = value => String(value ?? '').trim()
const digits = value => clean(value).replace(/\D/g, '')
const BIO_MAX = 500
const LOCAL_MAX = 120

// PUT   /api/profile  -> dados do perfil (nome, telefone, bio, localização, documentos...)
// PATCH /api/profile  -> troca/remove a foto: { photo_path: "<auth uid>/arquivo.jpg" | null }
export default async function handler(req, res) {
  if (!['PUT', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)
    const body = req.body || {}
    return req.method === 'PATCH' ? await updatePhoto(res, user, body) : await updateProfile(res, user, body)
  } catch (error) {
    return serverError(res, error)
  }
}

async function updatePhoto(res, user, body) {
  const path = body.photo_path === null || body.photo_path === '' ? null : clean(body.photo_path)
  if (path !== null) {
    if (!isValidAvatarPath(path, user.auth_user_id)) return badRequest(res, 'Caminho de foto inválido.')
    if (!(await avatarExists(path))) return badRequest(res, 'Não encontramos a foto enviada. Tenta de novo.')
  }
  const old = user.foto_perfil || null
  const updated = await updateOne('usuario', `id=eq.${encodeURIComponent(user.id)}`, { foto_perfil: path })
  if (old && old !== path) await deleteAvatar(old)
  return ok(res, { user: await buildPublicUser(updated || { ...user, foto_perfil: path }) })
}

async function updateProfile(res, user, body) {
  const name = clean(body.name)
  const phone = clean(body.phone)
  if (name.length < 2) return badRequest(res, 'Informe um nome válido.')
  if (digits(phone).length < 10) return badRequest(res, 'Informe um telefone válido.')

  const bio = body.bio !== undefined ? clean(body.bio) : user.bio || ''
  if (bio.length > BIO_MAX) return badRequest(res, `A biografia pode ter no máximo ${BIO_MAX} caracteres.`)
  const localizacao = body.localizacao !== undefined ? clean(body.localizacao) : user.localizacao || ''
  if (localizacao.length > LOCAL_MAX) return badRequest(res, 'Localização muito longa.')
  const address = body.address !== undefined ? clean(body.address) : user.endereco || ''
  const common = { nome: name, telefone: phone, endereco: address, bio: bio || null, localizacao: localizacao || null }
  const id = encodeURIComponent(user.id)

  if (user.tipo === 'vendedor') {
    const seller = await selectOne('vendedor', `id=eq.${id}`)
    const cpfCnpj = body.cpf_cnpj !== undefined ? digits(body.cpf_cnpj) : digits(seller?.cpf_cnpj || '')
    const businessName = body.business_name !== undefined ? clean(body.business_name) : seller?.comercial || ''
    if (cpfCnpj.length === 11 ? !validarCPF(cpfCnpj) : cpfCnpj.length === 14 ? !validarCNPJ(cpfCnpj) : true) return badRequest(res, 'CPF ou CNPJ inválido. Confere os números.')
    if (!businessName) return badRequest(res, 'Informe o estabelecimento ou nome da pessoa.')
    const duplicate = await selectOne('vendedor', `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}&id=neq.${id}`)
    if (duplicate) return badRequest(res, 'Este CPF/CNPJ já está cadastrado em outro vendedor.')
    await updateOne('usuario', `id=eq.${id}`, common)
    await updateOne('vendedor', `id=eq.${id}`, {
      cpf_cnpj: cpfCnpj,
      comercial: businessName,
      localizacao,
      entrega_propria: body.entrega_propria !== undefined ? Boolean(body.entrega_propria) : Boolean(seller?.entrega_propria),
    })
  } else {
    const buyer = await selectOne('comprador', `id=eq.${id}`)
    const cpf = body.cpf !== undefined ? digits(body.cpf) : buyer?.cpf || ''
    if (!validarCPF(cpf)) return badRequest(res, 'CPF inválido. Confere os números.')
    const duplicate = await selectOne('comprador', `cpf=eq.${encodeURIComponent(cpf)}&id=neq.${id}`)
    if (duplicate) return badRequest(res, 'Este CPF já está cadastrado em outro comprador.')
    await updateOne('usuario', `id=eq.${id}`, common)
    await updateOne('comprador', `id=eq.${id}`, { cpf })
  }
  const fresh = await selectOne('usuario', `id=eq.${id}`)
  return ok(res, { user: await buildPublicUser(fresh) })
}
