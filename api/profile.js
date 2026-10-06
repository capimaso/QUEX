import { selectOne, updateOne } from './_lib/db.js'
import { requireUser, buildPublicUser } from './_lib/auth.js'
import {
  badRequest,
  json,
  ok,
  serverError,
  unauthorized,
} from './_lib/http.js'
import { validarCPF, validarCNPJ } from './_lib/documents.js'
import {
  avatarExists,
  deleteAvatar,
  isValidAvatarPath,
} from './_lib/storage.js'
import {
  buildStoredAddress,
  lookupCep,
  ViaCepError,
} from './_lib/viacep.js'
import { tryGeocodeAddress } from './_lib/geocoding.js'

const clean = value => String(value ?? '').trim()
const digits = value => clean(value).replace(/\D/g, '')
const BIO_MAX = 500

export default async function handler(req, res) {
  if (!['PUT', 'PATCH'].includes(req.method)) {
    return res.status(405).json({
      error: 'Método não permitido.',
    })
  }

  try {
    const user = await requireUser(req)
    if (!user) return unauthorized(res)

    const body = req.body || {}

    return req.method === 'PATCH'
      ? await updatePhoto(res, user, body)
      : await updateProfile(res, user, body)
  } catch (error) {
    return serverError(res, error)
  }
}

async function updatePhoto(res, user, body) {
  const path =
    body.photo_path === null ||
    body.photo_path === ''
      ? null
      : clean(body.photo_path)

  if (path !== null) {
    if (!isValidAvatarPath(path, user.auth_user_id)) {
      return badRequest(res, 'Caminho de foto inválido.')
    }

    if (!(await avatarExists(path))) {
      return badRequest(
        res,
        'Não encontramos a foto enviada. Tenta de novo.'
      )
    }
  }

  const old = user.foto_perfil || null

  const updated = await updateOne(
    'usuario',
    `id=eq.${encodeURIComponent(user.id)}`,
    { foto_perfil: path }
  )

  if (old && old !== path) {
    await deleteAvatar(old)
  }

  return ok(res, {
    user: await buildPublicUser(
      updated || {
        ...user,
        foto_perfil: path,
      }
    ),
  })
}

async function resolveAddress(user, body) {
  const addressSent = [
    'cep',
    'numero',
    'complemento',
  ].some(key =>
    Object.prototype.hasOwnProperty.call(body, key)
  )

  const submittedCep = digits(body.cep)
  const submittedNumero = clean(body.numero)
  const submittedComplemento = clean(body.complemento)

  if (
    !addressSent ||
    (
      !submittedCep &&
      !submittedNumero &&
      !submittedComplemento &&
      !user.cep &&
      !user.numero
    )
  ) {
    return {
      cep: user.cep || null,
      numero: user.numero || null,
      complemento: user.complemento || null,
      cidade: user.cidade || null,
      uf: user.uf || null,
      lat: user.lat == null ? null : Number(user.lat),
      lng: user.lng == null ? null : Number(user.lng),
      endereco: user.endereco || '',
      localizacao:
        user.cidade && user.uf
          ? `${user.cidade} - ${user.uf}`
          : user.localizacao || null,
      geocodingWarning: null,
      changed: false,
    }
  }

  const cep = digits(
    body.cep !== undefined
      ? body.cep
      : user.cep
  )

  const numero = clean(
    body.numero !== undefined
      ? body.numero
      : user.numero
  )

  const complemento = clean(
    body.complemento !== undefined
      ? body.complemento
      : user.complemento
  )

  if (!/^\d{8}$/.test(cep)) {
    throw new ViaCepError(
      'Informe um CEP válido com 8 dígitos.',
      'invalid_cep'
    )
  }

  if (!numero) {
    throw new ViaCepError(
      'Informe o número do endereço.',
      'invalid_address'
    )
  }

  if (numero.length > 30) {
    throw new ViaCepError(
      'O número do endereço é muito longo.',
      'invalid_address'
    )
  }

  if (complemento.length > 120) {
    throw new ViaCepError(
      'O complemento pode ter no máximo 120 caracteres.',
      'invalid_address'
    )
  }

  const cepData = await lookupCep(cep)
  const localizacao = `${cepData.cidade} - ${cepData.uf}`

  const geo = await tryGeocodeAddress({
    cep: cepData.cep,
    numero,
    logradouro: cepData.logradouro,
    bairro: cepData.bairro,
    cidade: cepData.cidade,
    uf: cepData.uf,
  })

  return {
    cep: cepData.cep,
    numero,
    complemento: complemento || null,
    cidade: cepData.cidade,
    uf: cepData.uf,
    lat: geo.lat,
    lng: geo.lng,
    geocodingWarning: geo.warning,
    localizacao,
    endereco: buildStoredAddress({
      numero,
      complemento,
      cepData,
    }),
    changed: true,
  }
}

async function updateProfile(res, user, body) {
  const name = clean(body.name)
  const phone = clean(body.phone)

  if (name.length < 2) {
    return badRequest(res, 'Informe um nome válido.')
  }

  if (digits(phone).length < 10) {
    return badRequest(res, 'Informe um telefone válido.')
  }

  const bio =
    body.bio !== undefined
      ? clean(body.bio)
      : user.bio || ''

  if (bio.length > BIO_MAX) {
    return badRequest(
      res,
      `A biografia pode ter no máximo ${BIO_MAX} caracteres.`
    )
  }

  let address

  try {
    address = await resolveAddress(user, body)
  } catch (error) {
    if (error instanceof ViaCepError) {
      return json(
        res,
        error.code === 'viacep_unavailable' ? 503 : 400,
        {
          error: error.message,
          code: error.code,
        }
      )
    }

    throw error
  }

  const common = {
    nome: name,
    telefone: phone,
    endereco: address.endereco,
    bio: bio || null,
    localizacao: address.localizacao || null,
    cep: address.cep,
    numero: address.numero,
    complemento: address.complemento,
    cidade: address.cidade,
    uf: address.uf,
    lat: address.lat,
    lng: address.lng,
  }

  const id = encodeURIComponent(user.id)

  if (user.tipo === 'vendedor') {
    const seller = await selectOne(
      'vendedor',
      `id=eq.${id}`
    )

    const cpfCnpj =
      body.cpf_cnpj !== undefined
        ? digits(body.cpf_cnpj)
        : digits(seller?.cpf_cnpj || '')

    const businessName =
      body.business_name !== undefined
        ? clean(body.business_name)
        : seller?.comercial || ''

    if (
      cpfCnpj.length === 11
        ? !validarCPF(cpfCnpj)
        : cpfCnpj.length === 14
          ? !validarCNPJ(cpfCnpj)
          : true
    ) {
      return badRequest(
        res,
        'CPF ou CNPJ inválido. Confere os números.'
      )
    }

    if (!businessName) {
      return badRequest(
        res,
        'Informe o estabelecimento ou nome da pessoa.'
      )
    }

    const duplicate = await selectOne(
      'vendedor',
      `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}&id=neq.${id}`
    )

    if (duplicate) {
      return badRequest(
        res,
        'Este CPF/CNPJ já está cadastrado em outro vendedor.'
      )
    }

    await updateOne(
      'usuario',
      `id=eq.${id}`,
      common
    )

    await updateOne(
      'vendedor',
      `id=eq.${id}`,
      {
        cpf_cnpj: cpfCnpj,
        comercial: businessName,
        localizacao: address.localizacao || '',
        entrega_propria:
          body.entrega_propria !== undefined
            ? Boolean(body.entrega_propria)
            : Boolean(seller?.entrega_propria),
      }
    )
  } else {
    const buyer = await selectOne(
      'comprador',
      `id=eq.${id}`
    )

    const cpf =
      body.cpf !== undefined
        ? digits(body.cpf)
        : buyer?.cpf || ''

    if (!validarCPF(cpf)) {
      return badRequest(
        res,
        'CPF inválido. Confere os números.'
      )
    }

    const duplicate = await selectOne(
      'comprador',
      `cpf=eq.${encodeURIComponent(cpf)}&id=neq.${id}`
    )

    if (duplicate) {
      return badRequest(
        res,
        'Este CPF já está cadastrado em outro comprador.'
      )
    }

    await updateOne(
      'usuario',
      `id=eq.${id}`,
      common
    )

    await updateOne(
      'comprador',
      `id=eq.${id}`,
      { cpf }
    )
  }

  const fresh = await selectOne(
    'usuario',
    `id=eq.${id}`
  )

  return ok(res, {
    user: await buildPublicUser(fresh),
    geocoding_warning: address.geocodingWarning || null,
  })
}
