import React, { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  Loader2,
  Truck,
} from 'lucide-react'
import { getOnboardingFreightAverage } from '@/api/onboarding'
import {
  Input,
  Label,
} from '@/components/ui'

export default function DeliverySetupFields({
  enabled,
  rate,
  onEnabledChange,
  onRateChange,
  disabled = false,
}) {
  const [average, setAverage] = useState({
    media: null,
    quantidade: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getOnboardingFreightAverage()
      .then(data => {
        if (!active) return

        setAverage({
          media:
            data.media == null
              ? null
              : Number(data.media),
          quantidade: Number(data.quantidade || 0),
        })
      })
      .catch(() => {
        if (!active) return

        setAverage({
          media: null,
          quantidade: 0,
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const placeholder = useMemo(() => {
    if (
      average.quantidade >= 10 &&
      Number.isFinite(average.media)
    ) {
      return `Média do marketplace: R$ ${average.media
        .toFixed(2)
        .replace('.', ',')}/km`
    }

    return 'Ex: 2,50'
  }, [average])

  return (
    <section className="space-y-4 rounded-2xl border border-[#5A5FBF]/20 bg-[#5A5FBF]/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-[#0D1273] shadow-sm">
          <Truck className="h-5 w-5" />
        </div>

        <div>
          <h3 className="font-semibold text-[#0D1273]">
            Entrega
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            Você pode definir a entrega agora e alterar essa configuração depois no perfil.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
        <span>
          <span className="block text-sm font-medium text-gray-700">
            Aceito fazer entrega
          </span>
          <span className="mt-1 block text-xs text-gray-400">
            A retirada em mãos continua disponível.
          </span>
        </span>

        <input
          type="checkbox"
          checked={Boolean(enabled)}
          disabled={disabled}
          onChange={event =>
            onEnabledChange?.(event.target.checked)
          }
          className="h-5 w-5 accent-[#0D1273]"
        />
      </label>

      {enabled && (
        <div>
          <Label>Valor por Km (R$/km)</Label>

          <div className="relative mt-1.5">
            <Calculator className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              className="pl-10"
              type="number"
              min="0.01"
              step="0.01"
              required
              disabled={disabled}
              value={rate}
              onChange={event =>
                onRateChange?.(event.target.value)
              }
              placeholder={
                loading
                  ? 'Carregando referência...'
                  : placeholder
              }
            />

            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {average.quantidade >= 10 &&
            average.media != null
              ? `Média calculada com ${average.quantidade} vendedores que oferecem entrega.`
              : 'A média aparece quando houver pelo menos 10 vendedores com valor definido.'}
          </p>
        </div>
      )}
    </section>
  )
}
