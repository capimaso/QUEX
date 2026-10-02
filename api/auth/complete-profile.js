import { badRequest, created, ok, readBody, serverError, unauthorized, forbidden } from '../_lib/http.js'
import { buildPublicUser, resolveAccount } from '../_lib/auth.js'
import { createAccount, documentInUse, validateProfile } from '../_lib/accounts.js'

// 2ª etapa do Google: o usuário já existe no Supabase Auth, falta CPF, telefone, tipo de conta etc.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const account = await resolveAccount(req)
    if (!account) return unauthorized(res)
    const { authUser, usuario } = account
    const extras = { has_password: (authUser.app_metadata?.providers || []).includes('email') }
    if (usuario) return ok(res, { user: await buildPublicUser(usuario, extras) }) // já completo
    if (!authUser.email_confirmed_at) return forbidden(res, 'Confirme seu e-mail antes de completar o cadastro.')

    const body = readBody(req)
    const parsed = validateProfile(body)
    if (parsed.error) return badRequest(res, parsed.error)
    const profile = parsed.value
    if (!profile.localizacao) return badRequest(res, 'Informe sua localização (cidade/UF).')

    const inUse = await documentInUse(profile)
    if (inUse) return badRequest(res, inUse)

    const meta = authUser.user_metadata || {}
    const email = String(authUser.email || '').toLowerCase()
    const name = String(meta.full_name || meta.name || email.split('@')[0] || 'Usuário').trim().slice(0, 100)

    const novo = await createAccount({ authUserId: authUser.id, name, email, active: true, profile })
    return created(res, { user: await buildPublicUser(novo, extras) })
  } catch (error) {
    return serverError(res, error)
  }
}
