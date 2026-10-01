import crypto from 'node:crypto'
import { selectOne } from './db.js'

const COOKIE_NAME = 'quex_session'
const MAX_AGE = 60 * 60 * 24 * 7

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || ''
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.')
  return secret
}

export function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + MAX_AGE }))
  const unsigned = `${header}.${body}`
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

export function verifyToken(token) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const expected = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`)
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
}

function getCookies(req) {
  const header = req.headers.cookie || ''
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=')
    if (index === -1) return acc
    const key = part.slice(0, index).trim()
    const value = decodeURIComponent(part.slice(index + 1).trim())
    acc[key] = value
    return acc
  }, {})
}

export function getSessionPayload(req) {
  return verifyToken(getCookies(req)[COOKIE_NAME])
}

export async function requireUser(req) {
  const payload = getSessionPayload(req)
  if (!payload?.id) return null
  const user = await selectOne('usuario', `id=eq.${encodeURIComponent(payload.id)}`)
  if (!user) return null
  return user
}

export async function requireRole(req, role) {
  const user = await requireUser(req)
  if (!user) return { user: null, allowed: false }
  return { user, allowed: user.tipo === role }
}

export function publicUser(user, extras = {}) {
  return {
    id: Number(user.id),
    email: user.email,
    full_name: user.nome,
    phone: user.telefone || '',
    address: user.endereco || '',
    birth_date: user.data_nasc || null,
    role: user.tipo === 'vendedor' ? 'seller' : 'buyer',
    tipo: user.tipo,
    ...extras,
  }
}
