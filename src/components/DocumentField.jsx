import React from 'react'
import { FileText } from 'lucide-react'
import { Input, Label } from '@/components/ui'
import { formatarCPF, removerMascara, validarCPF } from '@/lib/validation/cpf'
import { formatarDocumento, validarDocumento } from '@/lib/validation/cnpj'

// kind="cpf"  -> só CPF (comprador)
// kind="doc"  -> CPF ou CNPJ (vendedor)
export default function DocumentField({ kind = 'cpf', label, value, onChange }) {
  const digits = removerMascara(value)
  const complete = kind === 'cpf' ? digits.length === 11 : digits.length === 11 || digits.length === 14
  const valid = kind === 'cpf' ? validarCPF(digits) : validarDocumento(digits)
  const showError = complete && !valid
  const showOk = complete && valid
  const format = kind === 'cpf' ? formatarCPF : formatarDocumento
  return (
    <div className="space-y-2">
      <Label>{label || (kind === 'cpf' ? 'CPF' : 'CPF/CNPJ')}</Label>
      <div className="relative">
        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className={`pl-10 ${showError ? '!border-red-400' : showOk ? '!border-green-400' : ''}`}
          required
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={e => onChange(format(e.target.value))}
          placeholder={kind === 'cpf' ? '000.000.000-00' : 'CPF ou CNPJ'}
        />
      </div>
      {showError && <p className="text-xs text-red-500">{digits.length === 14 ? 'CNPJ' : 'CPF'} inválido. Confere os números.</p>}
    </div>
  )
}
