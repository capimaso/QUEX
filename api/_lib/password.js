import crypto from 'node:crypto'

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password, stored) {
  if (!stored) return false
  if (!stored.startsWith('scrypt$')) return password === stored
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const actual = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}
