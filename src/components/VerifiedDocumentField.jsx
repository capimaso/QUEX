import React, { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { verifyOnboardingDocument } from '@/api/onboarding'
import { Input, Label } from '@/components/ui'
import {
  formatarCPF,
  removerMascara,
  validarCPF,
} from '@/lib/validation/cpf'
import {
  formatarDocumento,
  validarDocumento,
} from '@/lib/validation/cnpj'

export default function VerifiedDocumentField({
  kind = 'cpf',
  value,
  onChange,
  onVerificationChange,
  disabled = false,
}) {
  const requestRef = useRef(0)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const digits = removerMascara(value)
  const isCpfOnly = kind === 'cpf'
  const complete =
    isCpfOnly
      ? digits.length === 11
      : digits.length === 11 || digits.length === 14

  const locallyValid =
    isCpfOnly
      ? validarCPF(digits)
      : validarDocumento(digits)

  const format =
    isCpfOnly
      ? formatarCPF
      : formatarDocumento

  useEffect(() => {
    setResult(null)
    setError('')
    onVerificationChange?.(null)

    if (!complete || !locallyValid) {
      return undefined
    }

    const requestId = ++requestRef.current
    const timer = window.setTimeout(async () => {
      setLoading(true)

      try {
        const data = await verifyOnboardingDocument(digits)

        if (requestRef.current !== requestId) return

        setResult(data)
        setError('')
        onVerificationChange?.(data)

        if (data.warning) {
          toast(data.warning, {
            icon: '⚠️',
            duration: 7000,
          })
        }
      } catch (requestError) {
        if (requestRef.current !== requestId) return

        setResult(null)
        setError(
          requestError.message ||
            'Não foi possível validar o documento.'
        )
        onVerificationChange?.({
          error: true,
          message:
            requestError.message ||
            'Não foi possível validar o documento.',
        })
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
    }
  }, [digits, complete, locallyValid])

  const pending = Boolean(result?.pending)
  const verified = Boolean(result?.verified)

  const displayName =
    result?.kind === 'cnpj'
      ? result?.legal_name || ''
      : result?.official_name || ''

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>
          {isCpfOnly ? 'CPF' : 'CPF/CNPJ'}
        </Label>

        <div className="relative">
          <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <Input
            className={`pl-10 pr-10 ${
              complete && !locallyValid
                ? '!border-red-400'
                : verified
                  ? '!border-green-400'
                  : ''
            }`}
            required
            inputMode="numeric"
            autoComplete="off"
            value={value}
            disabled={disabled}
            onChange={event => {
              onChange?.(format(event.target.value))
            }}
            placeholder={
              isCpfOnly
                ? '000.000.000-00'
                : 'CPF ou CNPJ'
            }
          />

          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#0D1273]" />
          )}

          {!loading && verified && (
            <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
          )}
        </div>

        {complete && !locallyValid && (
          <p className="text-xs text-red-500">
            {digits.length === 14 ? 'CNPJ' : 'CPF'} inválido. Confere os números.
          </p>
        )}

        {error && (
          <p className="text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      {verified && displayName && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-green-700">
            <ShieldCheck className="h-4 w-4" />
            Nome obtido da Receita Federal
          </div>

          <Input
            value={displayName}
            readOnly
            className="bg-white"
            aria-label={
              result.kind === 'cnpj'
                ? 'Razão social obtida da Receita Federal'
                : 'Nome obtido da Receita Federal'
            }
          />
        </div>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Não foi possível validar seu documento agora. Tentaremos novamente em breve.
        </div>
      )}
    </div>
  )
}
