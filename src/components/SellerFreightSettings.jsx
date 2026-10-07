import React, { useEffect, useMemo, useState } from 'react'
import { Calculator, Save, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getFreightAverage,
  updateSellerFreight,
} from '@/api/commerce'
import {
  Button,
  Input,
  Label,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

export default function SellerFreightSettings({
  embedded = false,
}) {
  const { user, refreshUser } = useAuth()

  const [enabled, setEnabled] = useState(
    Boolean(user?.delivery_available)
  )
  const [rate, setRate] = useState(
    user?.value_per_km == null
      ? ''
      : String(user.value_per_km)
  )
  const [average, setAverage] = useState({
    media: null,
    quantidade: 0,
  })
  const [loadingAverage, setLoadingAverage] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEnabled(Boolean(user?.delivery_available))
    setRate(
      user?.value_per_km == null
        ? ''
        : String(user.value_per_km)
    )
  }, [user?.delivery_available, user?.value_per_km])

  useEffect(() => {
    let active = true

    getFreightAverage()
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
      .catch(error => {
        console.warn(
          '[QUÉX] Não foi possível carregar a média de frete:',
          error
        )

        if (active) {
          setAverage({
            media: null,
            quantidade: 0,
          })
        }
      })
      .finally(() => {
        if (active) setLoadingAverage(false)
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

  if (!user?.has_seller_profile && user?.role !== 'seller') {
    return null
  }

  const save = async () => {
    const numericRate = Number(rate)

    if (
      enabled &&
      (!Number.isFinite(numericRate) || numericRate <= 0)
    ) {
      return toast.error(
        'Informe um valor por quilômetro maior que zero.'
      )
    }

    setSaving(true)

    try {
      await updateSellerFreight({
        entrega_disponivel: enabled,
        valor_por_km: enabled ? numericRate : null,
      })

      await refreshUser()

      toast.success(
        enabled
          ? 'Configuração de entrega salva.'
          : 'Entrega pelo vendedor desativada.'
      )
    } catch (error) {
      console.error(
        '[QUÉX] Falha ao salvar configuração de entrega:',
        error
      )

      toast.error(
        error.message ||
          'Não foi possível salvar a configuração de entrega.'
      )
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]">
          <Truck className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-heading text-lg font-bold text-[#0D1273]">
            Entrega
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Defina se você faz entregas e quanto cobra por quilômetro.
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
        <span>
          <span className="block text-sm font-medium">
            Aceito fazer entrega
          </span>

          <span className="mt-1 block text-xs text-gray-400">
            A retirada em mãos continua disponível no checkout.
          </span>
        </span>

        <input
          type="checkbox"
          checked={enabled}
          onChange={event =>
            setEnabled(event.target.checked)
          }
          className="h-5 w-5 accent-[#0D1273]"
        />
      </label>

      {enabled && (
        <div>
          <Label>Valor por quilômetro (R$/km)</Label>

          <div className="relative mt-1.5">
            <Calculator className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              className="pl-10"
              type="number"
              min="0.01"
              step="0.01"
              value={rate}
              onChange={event =>
                setRate(event.target.value)
              }
              placeholder={
                loadingAverage
                  ? 'Carregando referência...'
                  : placeholder
              }
            />
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {average.quantidade >= 10 &&
            average.media != null
              ? `Referência calculada com ${average.quantidade} vendedores que oferecem entrega.`
              : 'A média do marketplace só aparece quando houver pelo menos 10 vendedores com valor definido.'}
          </p>
        </div>
      )}

      {(user?.lat == null || user?.lng == null) && enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Seu endereço ainda não possui coordenadas. Confira o CEP e salve o perfil novamente para liberar o cálculo por rota.
        </div>
      )}

      <Button
        onClick={save}
        disabled={saving}
      >
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Salvando...' : 'Salvar configuração de entrega'}
      </Button>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 sm:px-6 lg:px-8">
      {content}
    </div>
  )
}
