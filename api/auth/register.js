import { selectOne } from '../_lib/db.js'
import { badRequest, created, readBody, serverError } from '../_lib/http.js'
import { createAccount, documentInUse, validateProfile } from '../_lib/accounts.js'
import { adminDeleteUser, signUpWithEmail } from '../_lib/supabaseAuth.js'

// Cadastro tradicional: valida tudo, cria no Supabase Auth (que manda o e-mail de confirmação)
// e cria usuario/comprador/vendedor com is_active = false até confirmar o e-mail.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  let authUserId = null
  try {
    const body = readBody(req)
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (name.length < 2) return badRequest(res, 'Informe um nome válido.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest(res, 'Informe um e-mail válido.')
    if (password.length < 6) return badRequest(res, 'A senha deve ter no mínimo 6 caracteres.')

    const parsed = validateProfile(body)
    if (parsed.error) return badRequest(res, parsed.error)
    const profile = parsed.value

    if (await selectOne('usuario', `email=eq.${encodeURIComponent(email)}`)) {
      return badRequest(res, 'Este e-mail já está cadastrado. Tenta entrar ou recuperar a senha.')
    }
    const inUse = await documentInUse(profile)
    if (inUse) return badRequest(res, inUse)

    const redirectTo = String(body.redirect_to || '').trim() || undefined
    const authUser = await signUpWithEmail({ email, password, data: { full_name: name, role: profile.role }, redirectTo })
    authUserId = authUser?.id
    if (!authUserId) throw new Error('O Supabase não retornou o usuário criado.')
    // identities vazio = e-mail já existe no Supabase Auth (resposta "disfarçada")
    if (Array.isArray(authUser.identities) && authUser.identities.length === 0) {
      authUserId = null
      return badRequest(res, 'Este e-mail já está cadastrado. Tenta entrar ou recuperar a senha.')
    }

    // Se a confirmação de e-mail estiver DESLIGADA no painel, o e-mail já vem confirmado.
    const confirmed = Boolean(authUser.email_confirmed_at)
    await createAccount({ authUserId, name, email, active: confirmed, profile })

    return created(res, { pending_verification: !confirmed, email })
  } catch (error) {
    if (authUserId) await adminDeleteUser(authUserId).catch(() => {})
    return serverError(res, error)
  }
}
