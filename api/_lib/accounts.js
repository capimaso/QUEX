import { insertOne, selectOne, deleteWhere } from './db.js'
import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'
import { lookupCep, buildStoredAddress } from './viacep.js'
import { tryGeocodeAddress } from './geocoding.js'

export const SENHA_MARCADOR = '!supabase-auth'

const clean = value => String(value ?? '').trim()

export function validateProfile(body) {
  const role = body.role === 'seller' ? 'seller' : 'buyer'
  const phone = clean(body.phone)
  const cpf = onlyDigits(body.cpf)
  const cpfCnpj = onlyDigits(body.cpf_cnpj)
  const businessName = clean(body.business_name)
  const phoneDigits = onlyDigits(phone).length
  const cep = onlyDigits(body.cep)
  const numero = clean(body.numero)
  const complemento = clean(body.complemento)
  const deliveryAvailable = Boolean(body.entrega_disponivel)

  const rawRate = body.valor_por_km
  const valuePerKm =
    rawRate === '' ||
    rawRate === null ||
    rawRate === undefined
      ? null
      : Number(rawRate)

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

  return {
    value: {
      role,
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
    logradouro: cepData.logradouro,
    bairro: cepData.bairro,
    cidade: cepData.cidade,
    uf: cepData.uf,
  })

  return {
    ...profile,
    cep: cepData.cep,
    cidade: cepData.cidade,
    uf: cepData.uf,
    lat: geo.lat,
    lng: geo.lng,
    geocodingWarning: geo.warning,
    localizacao,
    endereco: buildStoredAddress({
      numero: profile.numero,
      complemento: profile.complemento,
      cepData,
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

  const officialName =
    kind === 'cpf'
      ? String(documentVerification.officialName || '').trim()
      : String(documentVerification.legalName || '').trim()

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
      ? officialName
      : tradeName

  const usuario = await insertOne('usuario', {
    nome: accountName,
    email,
    senha: SENHA_MARCADOR,
    telefone: profile.phone,
    endereco: profile.endereco,
    localizacao: profile.localizacao,
    cep: profile.cep,
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
    /*
      CPF sempre permanece bloqueado para edição manual.
      Se a validação externa ficar pendente, o nome fica vazio até uma
      revalidação posterior; o cliente nunca injeta um nome arbitrário.
      CNPJ mantém apenas o nome fantasia editável.
    */
    nome_imutavel: kind === 'cpf',
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
            : officialName,
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
