import { insertOne, selectOne, deleteWhere } from './db.js'
import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'
import { lookupCep, buildStoredAddress } from './viacep.js'

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

    if (!businessName) {
      return { error: 'Informe o nome do estabelecimento ou da pessoa.' }
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
    },
  }
}

export async function verifyProfileAddress(profile) {
  const cepData = await lookupCep(profile.cep)
  const localizacao = `${cepData.cidade} - ${cepData.uf}`

  return {
    ...profile,
    cep: cepData.cep,
    cidade: cepData.cidade,
    uf: cepData.uf,
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
  name,
  email,
  active,
  profile,
}) {
  const usuario = await insertOne('usuario', {
    nome: name,
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
    tipo: profile.role === 'seller' ? 'vendedor' : 'comprador',
    auth_user_id: authUserId,
    is_active: Boolean(active),
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
        comercial: profile.businessName,
        entrega_propria: false,
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
