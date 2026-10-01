import { removerMascara } from './cpf.js'
import { validarCPF, formatarCPF } from './cpf.js'

export function validarCNPJ(value) {
  const c = removerMascara(value)
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

// Máscara progressiva: 00.000.000/0000-00
export function formatarCNPJ(value) {
  const d = removerMascara(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

// Vendedor pode ter CPF (11) ou CNPJ (14)
export function validarDocumento(value) {
  const d = removerMascara(value)
  if (d.length === 11) return validarCPF(d)
  if (d.length === 14) return validarCNPJ(d)
  return false
}

export function formatarDocumento(value) {
  const d = removerMascara(value)
  return d.length <= 11 ? formatarCPF(d) : formatarCNPJ(d)
}
