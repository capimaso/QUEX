import React from 'react'
import { FileText, LockKeyhole } from 'lucide-react'
import { Input, Label } from '@/components/ui'
import { formatarCPF, removerMascara, validarCPF } from '@/lib/validation/cpf'
import { formatarDocumento, validarDocumento } from '@/lib/validation/cnpj'

export default function DocumentField({
  kind = 'cpf',
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
}) {
  const digits = removerMascara(value)
  const complete =
    kind === 'cpf'
      ? digits.length === 11
      : digits.length === 11 || digits.length === 14
  const valid =
    kind === 'cpf'
      ? validarCPF(digits)
      : validarDocumento(digits)
  const showError = complete && !valid
  const showOk = complete && valid
  const format =
    kind === 'cpf'
      ? formatarCPF
      : formatarDocumento

  const locked = disabled || readOnly

  return (
    <div className="space-y-2">
      <Label>
        {label || (kind === 'cpf' ? 'CPF' : 'CPF/CNPJ')}
      </Label>

      <div className="relative">
        <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

        <Input
          className={`pl-10 ${locked ? 'pr-10 bg-gray-50' : ''} ${
            !locked && showError
              ? '!border-red-400'
              : !locked && showOk
                ? '!border-green-400'
                : ''
          }`}
          required
          inputMode="numeric"
          autoComplete="off"
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={event => {
            if (!locked) onChange?.(format(event.target.value))
          }}
          placeholder={
            kind === 'cpf'
              ? '000.000.000-00'
              : 'CPF ou CNPJ'
          }
        />

        {locked && (
          <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        )}
      </div>

      {locked ? (
        <p className="text-xs text-gray-400">
          Documento confirmado no cadastro e não pode ser alterado.
        </p>
      ) : (
        showError && (
          <p className="text-xs text-red-500">
            {digits.length === 14 ? 'CNPJ' : 'CPF'} inválido. Confere os números.
          </p>
        )
      )}
    </div>
  )
}
