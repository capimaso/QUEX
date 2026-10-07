import { normalizeText } from './text.js'

const CONTACT_WARNING =
  'Não é permitido compartilhar contatos. Mantenha a negociação dentro da plataforma.'

const NUMBER_WORDS = new Set([
  'zero',
  'um',
  'uma',
  'dois',
  'duas',
  'tres',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
])

const SOCIAL_TERMS = [
  'whatsapp',
  'whats app',
  'zap',
  'wpp',
  'telegram',
  'insta',
  'instagram',
  'facebook',
  'face',
  'twitter',
  'tiktok',
  'tik tok',
  'discord',
  'me chama no',
  'chama no',
  'passa o contato',
  'passa contato',
  'manda mensagem no',
  'manda msg no',
  'meu contato',
  'meu telefone',
  'meu numero',
  'numero e',
  'numero eh',
]

function result(bloqueado, motivo = null) {
  return {
    bloqueado,
    motivo,
    mensagem: bloqueado ? CONTACT_WARNING : null,
  }
}

function hasEmail(raw) {
  return /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(raw)
}

function hasLink(raw) {
  return (
    /(?:https?:\/\/|www\.)\S+/i.test(raw) ||
    /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com(?:\.br)?|net|org|io|app|dev|me|gg|co|br)(?:\/\S*)?\b/i.test(
      raw
    )
  )
}

function hasPhone(raw) {
  // Sequência contínua de 10 a 13 dígitos (inclui DDI 55).
  if (/(?:^|\D)\d{10,13}(?:\D|$)/.test(raw)) {
    return true
  }

  // Telefone com separadores: (11) 99999-9999, 11 9 9999-9999 etc.
  const candidates = raw.match(
    /(?:\+?\d[\d\s().-]{8,}\d)/g
  )

  return Boolean(
    candidates?.some(candidate => {
      const digits = candidate.replace(/\D/g, '')
      return digits.length >= 10 && digits.length <= 13
    })
  )
}

function hasSocialTerm(normalized) {
  return SOCIAL_TERMS.some(term => {
    const normalizedTerm = normalizeText(term)
    return normalized.includes(normalizedTerm)
  })
}

function hasObfuscatedNumber(normalized) {
  const tokens = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let consecutive = 0

  for (const token of tokens) {
    if (NUMBER_WORDS.has(token)) {
      consecutive += 1

      if (consecutive >= 3) {
        return true
      }
    } else {
      consecutive = 0
    }
  }

  return false
}

export function antiContact(text) {
  const raw = String(text ?? '').trim()
  const normalized = normalizeText(raw)

  if (!raw) {
    return result(false)
  }

  if (hasEmail(raw)) {
    return result(true, 'email')
  }

  if (hasLink(raw)) {
    return result(true, 'link')
  }

  if (hasPhone(raw)) {
    return result(true, 'telefone')
  }

  if (hasSocialTerm(normalized)) {
    return result(true, 'rede_social_ou_contato')
  }

  if (hasObfuscatedNumber(normalized)) {
    return result(true, 'numero_ofuscado')
  }

  return result(false)
}

export { CONTACT_WARNING }
