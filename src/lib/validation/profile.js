const normalizeName = value =>
  String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')

export function validatePersonName(value) {
  const name = normalizeName(value)

  if (!name) return 'Informe seu nome completo.'
  if (name.length > 100) return 'O nome pode ter no máximo 100 caracteres.'
  if (!/^[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+)+$/u.test(name)) {
    return 'Informe pelo menos duas palavras usando somente letras e espaços.'
  }

  return ''
}

export function validateBirthDate(value) {
  const birthDate = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return 'Informe uma data de nascimento válida.'
  }

  const parsed = new Date(birthDate + 'T00:00:00.000Z')
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) {
    return 'Informe uma data de nascimento válida.'
  }

  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  if (birthDate > today) return 'A data de nascimento não pode ser futura.'

  let age = now.getFullYear() - parsed.getUTCFullYear()
  const birthdayHasPassed =
    now.getMonth() + 1 > parsed.getUTCMonth() + 1 ||
    (
      now.getMonth() + 1 === parsed.getUTCMonth() + 1 &&
      now.getDate() >= parsed.getUTCDate()
    )

  if (!birthdayHasPassed) age -= 1
  if (age < 18) {
    return 'Você precisa ter pelo menos 18 anos para se cadastrar no QUÉX.'
  }
  if (age > 120) return 'A idade máxima para cadastro é 120 anos.'

  return ''
}
