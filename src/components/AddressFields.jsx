import React, {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  CheckCircle2,
  Loader2,
  MapPin,
} from 'lucide-react'
import {
  Input,
  Label,
} from '@/components/ui'
import {
  formatCep,
  lookupCep,
  onlyCepDigits,
} from '@/lib/viacep'

export default function AddressFields({
  value,
  onChange,
  onValidityChange,
  disabled = false,
}) {
  const [cepError, setCepError] =
    useState('')
  const [checking, setChecking] =
    useState(false)

  const requestRef = useRef(0)
  const latestValueRef =
    useRef(value)
  const lastVerifiedCepRef =
    useRef('')

  latestValueRef.current = value

  const patch = payload => {
    onChange({
      ...latestValueRef.current,
      ...payload,
    })
  }

  useEffect(() => {
    const digits =
      onlyCepDigits(value.cep)

    if (digits.length !== 8) {
      lastVerifiedCepRef.current =
        ''
      setCepError('')
      setChecking(false)

      if (
        value.cidade ||
        value.uf
      ) {
        patch({
          cidade: '',
          uf: '',
        })
      }

      onValidityChange?.(false)
      return
    }

    if (
      lastVerifiedCepRef.current ===
        digits &&
      value.cidade &&
      value.uf
    ) {
      setCepError('')
      setChecking(false)
      onValidityChange?.(true)
      return
    }

    const requestId =
      ++requestRef.current

    setChecking(true)
    setCepError('')
    onValidityChange?.(false)

    lookupCep(digits)
      .then(result => {
        if (
          requestId !==
          requestRef.current
        ) {
          return
        }

        lastVerifiedCepRef.current =
          result.cep

        patch({
          cep: formatCep(
            result.cep
          ),
          cidade:
            result.cidade,
          uf: result.uf,
        })

        onValidityChange?.(true)
      })
      .catch(error => {
        if (
          requestId !==
          requestRef.current
        ) {
          return
        }

        lastVerifiedCepRef.current =
          ''

        patch({
          cidade: '',
          uf: '',
        })

        setCepError(
          error.message ||
            'Não foi possível consultar o CEP.'
        )

        onValidityChange?.(false)
      })
      .finally(() => {
        if (
          requestId ===
          requestRef.current
        ) {
          setChecking(false)
        }
      })
  }, [value.cep])

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div>
        <h3 className="font-semibold text-[#0D1273]">
          Endereço
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Cidade e UF são confirmadas automaticamente pelo CEP. CEP, número e complemento nunca aparecem no perfil público.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>CEP</Label>

          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              className="pl-10 pr-10"
              inputMode="numeric"
              autoComplete="postal-code"
              value={
                formatCep(value.cep)
              }
              onChange={event => {
                const next =
                  formatCep(
                    event.target.value
                  )

                if (
                  onlyCepDigits(
                    next
                  ) !==
                  onlyCepDigits(
                    value.cep
                  )
                ) {
                  lastVerifiedCepRef.current =
                    ''
                }

                patch({
                  cep: next,
                  cidade: '',
                  uf: '',
                })
              }}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled}
              required
            />

            {checking && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#0D1273]" />
            )}

            {!checking &&
              value.cidade &&
              value.uf &&
              !cepError && (
                <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600" />
              )}
          </div>

          {cepError && (
            <p className="text-xs text-red-600">
              {cepError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Número</Label>

          <Input
            value={value.numero}
            onChange={event =>
              patch({
                numero:
                  event.target.value,
              })
            }
            placeholder="Ex.: 120"
            maxLength={30}
            disabled={disabled}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Complemento{' '}
          <span className="font-normal text-gray-400">
            (opcional)
          </span>
        </Label>

        <Input
          value={value.complemento}
          onChange={event =>
            patch({
              complemento:
                event.target.value,
            })
          }
          placeholder="Apartamento, bloco, referência..."
          maxLength={120}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
        <div className="space-y-2">
          <Label>Cidade</Label>

          <Input
            value={value.cidade}
            readOnly
            disabled
            className="bg-gray-50"
            placeholder="Preenchida pelo CEP"
          />
        </div>

        <div className="space-y-2">
          <Label>UF</Label>

          <Input
            value={value.uf}
            readOnly
            disabled
            className="bg-gray-50"
            placeholder="UF"
          />
        </div>
      </div>
    </div>
  )
}
