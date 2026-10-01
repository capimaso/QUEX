// Validação matemática de CPF (dígitos verificadores).
// A mesma lógica roda na API (api/_lib/documents.js) e no banco (quex_cpf_valido).

export const removerMascara = value => String(value ?? '').replace(/\D/g, '')

export function validarCPF(value) {
  const c = removerMascara(value)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  for (const t of [9, 10]) {
    let sum = 0
    for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i)
    if (((sum * 10) % 11) % 10 !== Number(c[t])) return false
  }
  return true
}

// Máscara progressiva: 000.000.000-00
export function formatarCPF(value) {
  const d = removerMascara(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}
