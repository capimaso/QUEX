import { insertOne, selectOne, deleteWhere } from './db.js'
import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'
import { lookupCep, buildStoredAddress } from './viacep.js'
import { tryGeocodeAddress } from './geocoding.js'

export const SENHA_MARCADOR = '!supabase-auth'

const clean = value => String(value ?? '').trim()
const normalizeName = value =>
  clean(value).normalize('NFC').replace(/\s+/gu, ' ')

function personNameError(value) {
  const name = normalizeName(value)
  if (!name) return 'Informe seu nome completo.'
  if (name.length > 100) {
    return 'O nome pode ter no máximo 100 caracteres.'
  }
  if (!/^[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+)+$/u.test(name)) {
    return 'Informe pelo menos duas palavras usando somente letras e espaços.'
  }
  return ''
}

function validateBirthDate(value) {
  const birthDate = clean(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return 'Informe uma data de nascimento válida.'
  }

  const parsed = new Date(birthDate + 'T00:00:00.000Z')
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== birthDate
  ) {
    return 'Informe uma data de nascimento válida.'
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(part => [part.type, part.value])
  )
  const today = parts.year + '-' + parts.month + '-' + parts.day

  if (birthDate > today) {
    return 'A data de nascimento não pode ser futura.'
  }

  let age = Number(parts.year) - parsed.getUTCFullYear()
  const birthMonth = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  if (
    parts.month < birthMonth ||
    (parts.month === birthMonth && Number(parts.day) < parsed.getUTCDate())
  ) {
    age -= 1
  }

  if (age < 18) {
    return 'Você precisa ter pelo menos 18 anos para se cadastrar no QUÉX.'
  }
  if (age > 120) {
    return 'A idade máxima para cadastro é 120 anos.'
  }

  return ''
}

export function validateProfile(body) {
  const role = body.role === 'seller' ? 'seller' : 'buyer'
  const phone = clean(body.phone)
  const cpf = onlyDigits(body.cpf)
  const cpfCnpj = onlyDigits(body.cpf_cnpj)
  const businessName = clean(body.business_name)
  const name = normalizeName(body.name)
  const birthDate = clean(body.birth_date)
  const phoneDigits = onlyDigits(phone).length
  const cep = onlyDigits(body.cep)
  const numero = clean(body.numero)
  const complemento = clean(body.complemento)
  const rua = clean(body.rua)
  const bairro = clean(body.bairro)
  const deliveryAvailable = Boolean(body.entrega_disponivel)

  const rawRate = body.valor_por_km
  const valuePerKm =
    rawRate === '' ||
    rawRate === null ||
    rawRate === undefined
      ? null
      : Number(rawRate)

  const birthDateError = validateBirthDate(birthDate)
  if (birthDateError) return { error: birthDateError }

  if (phoneDigits < 10 || phoneDigits > 13) {
    return { error: 'Informe um telefone válido com DDD.' }
  }

  if (role === 'buyer') {
    if (!validarCPF(cpf)) {
      return { error: 'CPF inválido. Confere os números.' }
    }
  } else {
    if (cpfCnpj.length === 11) {
      if (!validarCPF(cpfCnpj)) {
        return { error: 'CPF inválido. Confere os números.' }
      }
    } else if (cpfCnpj.length === 14) {
      if (!validarCNPJ(cpfCnpj)) {
        return { error: 'CNPJ inválido. Confere os números.' }
      }
    } else {
      return {
        error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
      }
    }

    if (
      deliveryAvailable &&
      (!Number.isFinite(valuePerKm) || valuePerKm <= 0)
    ) {
      return {
        error:
          'Informe um valor por quilômetro maior que zero para oferecer entrega.',
      }
    }

    if (
      valuePerKm !== null &&
      (!Number.isFinite(valuePerKm) || valuePerKm <= 0)
    ) {
      return {
        error: 'O valor por quilômetro deve ser maior que zero.',
      }
    }
  }

  const cpfAccount = role === 'buyer' || cpfCnpj.length === 11
  if (cpfAccount) {
    const nameError = personNameError(name)
    if (nameError) return { error: nameError }
  } else if (!businessName) {
    return { error: 'Informe o nome fantasia.' }
  }

  if (!/^\d{8}$/.test(cep)) {
    return { error: 'Informe um CEP válido com 8 dígitos.' }
  }

  if (!numero) {
    return { error: 'Informe o número do endereço.' }
  }

  if (numero.length > 30) {
    return { error: 'O número do endereço é muito longo.' }
  }

  if (complemento.length > 120) {
    return { error: 'O complemento pode ter no máximo 120 caracteres.' }
  }

  if (!rua) return { error: 'Informe a rua do endereço.' }
  if (rua.length > 180) {
    return { error: 'A rua pode ter no máximo 180 caracteres.' }
  }
  if (!bairro) return { error: 'Informe o bairro do endereço.' }
  if (bairro.length > 120) {
    return { error: 'O bairro pode ter no máximo 120 caracteres.' }
  }

  return {
    value: {
      role,
      name,
      birthDate,
      rua,
      bairro,
      phone,
      cpf,
      cpfCnpj,
      businessName,
      cep,
      numero,
      complemento,
      deliveryAvailable,
      valuePerKm:
        deliveryAvailable && valuePerKm != null
          ? Math.round((valuePerKm + Number.EPSILON) * 100) / 100
          : null,
    },
  }
}

export async function verifyProfileAddress(profile) {
  const cepData = await lookupCep(profile.cep)
  const localizacao = `${cepData.cidade} - ${cepData.uf}`

  const geo = await tryGeocodeAddress({
    cep: cepData.cep,
    numero: profile.numero,
    logradouro: profile.rua,
    bairro: profile.bairro,
    cidade: cepData.cidade,
    uf: cepData.uf,
  })

  return {
    ...profile,
    cep: cepData.cep,
    rua: profile.rua,
    bairro: profile.bairro,
    cidade: cepData.cidade,
    uf: cepData.uf,
    lat: geo.lat,
    lng: geo.lng,
    geocodingWarning: geo.warning,
    localizacao,
    endereco: buildStoredAddress({
      numero: profile.numero,
      complemento: profile.complemento,
      cepData: {
        ...cepData,
        logradouro: profile.rua,
        bairro: profile.bairro,
      },
    }),
  }
}

export async function documentInUse({ role, cpf, cpfCnpj }) {
  if (role === 'buyer') {
    if (
      await selectOne(
        'comprador',
        `cpf=eq.${encodeURIComponent(cpf)}`
      )
    ) {
      return 'Este CPF já está cadastrado.'
    }
  } else if (
    await selectOne(
      'vendedor',
      `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}`
    )
  ) {
    return 'Este CPF/CNPJ já está cadastrado.'
  }

  return null
}

export async function createAccount({
  authUserId,
  email,
  active,
  profile,
  documentVerification,
}) {
  if (!documentVerification?.kind) {
    throw new Error('A verificação do documento é obrigatória.')
  }

  const kind = documentVerification.kind
  const pending = Boolean(documentVerification.pending)

  const tradeName =
    kind === 'cnpj'
      ? String(
          profile.businessName ||
          documentVerification.tradeName ||
          documentVerification.legalName ||
          ''
        ).trim()
      : ''

  const accountName =
    kind === 'cpf'
      ? profile.name
      : tradeName

  const usuario = await insertOne('usuario', {
    nome: accountName,
    email,
    senha: SENHA_MARCADOR,
    telefone: profile.phone,
    endereco: profile.endereco,
    data_nascimento: profile.birthDate,
    localizacao: profile.localizacao,
    cep: profile.cep,
    rua: profile.rua,
    bairro: profile.bairro,
    numero: profile.numero,
    complemento: profile.complemento || null,
    cidade: profile.cidade,
    uf: profile.uf,
    lat: profile.lat,
    lng: profile.lng,
    tipo: profile.role === 'seller' ? 'vendedor' : 'comprador',
    auth_user_id: authUserId,
    is_active: Boolean(active),
    razao_social:
      kind === 'cnpj'
        ? String(documentVerification.legalName || '').trim() || null
        : null,
    // O CPF usa o nome digitado e validado pelo backend.
    nome_imutavel: false,
    verificacao_pendente: pending,
  })

  try {
    if (profile.role === 'buyer') {
      await insertOne('comprador', {
        id: usuario.id,
        cpf: profile.cpf,
      })
    } else {
      await insertOne('vendedor', {
        id: usuario.id,
        comercial:
          kind === 'cnpj'
            ? tradeName
            : profile.name,
        entrega_propria: false,
        entrega_disponivel: Boolean(profile.deliveryAvailable),
        valor_por_km:
          profile.deliveryAvailable
            ? profile.valuePerKm
            : null,
        cpf_cnpj: profile.cpfCnpj,
        localizacao: profile.localizacao,
      })
    }
  } catch (error) {
    await deleteWhere(
      'usuario',
      `id=eq.${encodeURIComponent(usuario.id)}`
    ).catch(() => {})
    throw error
  }

  return usuario
}
