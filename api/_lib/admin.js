import { requireUser } from './auth.js'

export const ADMIN_LEVELS = new Set(['adm', 'ceo'])

export function accessLevel(user) {
  const value = String(user?.nivel_acesso || 'comum').toLowerCase()
  return ADMIN_LEVELS.has(value) ? value : 'comum'
}

export async function resolveAdmin(req) {
  const user = await requireUser(req)
  if (!user) return { user: null, level: 'comum', allowed: false }

  const level = accessLevel(user)
  return {
    user,
    level,
    allowed: ADMIN_LEVELS.has(level),
  }
}

export function canBanUser(actor, target) {
  if (!actor || !target) return false
  if (Number(actor.id) === Number(target.id)) return false
  if (target.banido_em) return false

  const actorLevel = accessLevel(actor)
  const targetLevel = accessLevel(target)

  if (actorLevel === 'ceo') return true
  if (actorLevel === 'adm') return targetLevel === 'comum'
  return false
}
