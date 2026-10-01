// Validação de CPF/CNPJ no servidor (espelha src/lib/validation/*).
// Nunca confie só no front: alguém pode chamar a API na mão.

export const onlyDigits = value => String(value ?? '').replace(/\D/g, '')

export function validarCPF(value) {
  const c = onlyDigits(value)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  for (const t of [9, 10]) {
    let sum = 0
    for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i)
    if (((sum * 10) % 11) % 10 !== Number(c[t])) return false
  }
  return true
}

export function validarCNPJ(value) {
  const c = onlyDigits(value)
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const calc = (len, weights) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(c[i]) * weights[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = calc(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === Number(c[12]) && d2 === Number(c[13])
}

export function validarDocumento(value) {
  const d = onlyDigits(value)
  if (d.length === 11) return validarCPF(d)
  if (d.length === 14) return validarCNPJ(d)
  return false
}
