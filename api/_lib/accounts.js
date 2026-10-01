import { insertOne, selectOne, deleteWhere } from './db.js'
import { onlyDigits, validarCPF, validarCNPJ } from './documents.js'

// `usuario.senha` é NOT NULL no schema, mas a senha agora vive no Supabase Auth.
// Esse marcador nunca bate com nenhuma senha real.
export const SENHA_MARCADOR = '!supabase-auth'

const clean = value => String(value ?? '').trim()

// Valida os campos de perfil (usado no cadastro normal e no "completar cadastro" do Google)
export function validateProfile(body) {
  const role = body.role === 'seller' ? 'seller' : 'buyer'
  const phone = clean(body.phone)
  const cpf = onlyDigits(body.cpf)
  const cpfCnpj = onlyDigits(body.cpf_cnpj)
  const businessName = clean(body.business_name)
  const localizacao = clean(body.localizacao)
  const phoneDigits = onlyDigits(phone).length

  if (phoneDigits < 10 || phoneDigits > 13) return { error: 'Informe um telefone válido com DDD.' }

  if (role === 'buyer') {
    if (!validarCPF(cpf)) return { error: 'CPF inválido. Confere os números.' }
  } else {
    if (cpfCnpj.length === 11) {
      if (!validarCPF(cpfCnpj)) return { error: 'CPF inválido. Confere os números.' }
    } else if (cpfCnpj.length === 14) {
      if (!validarCNPJ(cpfCnpj)) return { error: 'CNPJ inválido. Confere os números.' }
    } else {
      return { error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' }
    }
    if (!businessName) return { error: 'Informe o nome do estabelecimento ou da pessoa.' }
  }
  return { value: { role, phone, cpf, cpfCnpj, businessName, localizacao } }
}

// Retorna uma mensagem de erro se o CPF/CNPJ já estiver em uso.
export async function documentInUse({ role, cpf, cpfCnpj }) {
  if (role === 'buyer') {
    if (await selectOne('comprador', `cpf=eq.${encodeURIComponent(cpf)}`)) return 'Este CPF já está cadastrado.'
  } else if (await selectOne('vendedor', `cpf_cnpj=eq.${encodeURIComponent(cpfCnpj)}`)) {
    return 'Este CPF/CNPJ já está cadastrado.'
  }
  return null
}

// Cria usuario + comprador/vendedor. Se algo falhar no meio, desfaz.
export async function createAccount({ authUserId, name, email, active, profile }) {
  const usuario = await insertOne('usuario', {
    nome: name,
    email,
    senha: SENHA_MARCADOR,
    telefone: profile.phone,
    endereco: '',
    localizacao: profile.localizacao || null,
    tipo: profile.role === 'seller' ? 'vendedor' : 'comprador',
    auth_user_id: authUserId,
    is_active: Boolean(active),
  })
  try {
    if (profile.role === 'buyer') {
      await insertOne('comprador', { id: usuario.id, cpf: profile.cpf })
    } else {
      await insertOne('vendedor', {
        id: usuario.id,
        comercial: profile.businessName,
        entrega_propria: false,
        cpf_cnpj: profile.cpfCnpj,
        localizacao: profile.localizacao || '',
      })
    }
  } catch (error) {
    await deleteWhere('usuario', `id=eq.${encodeURIComponent(usuario.id)}`).catch(() => {})
    throw error
  }
  return usuario
}
