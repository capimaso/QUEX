import React, { useEffect, useState } from 'react'
import { Percent, Save, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPlatformConfig,
  updatePlatformConfig,
} from '@/api/commerce'
import {
  Button,
  Input,
  Label,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

export default function PlatformConfigPanel() {
  const { user } = useAuth()
  const [config, setConfig] = useState(null)
  const [rate, setRate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const level = String(
    user?.access_level || 'comum'
  ).toLowerCase()

  useEffect(() => {
    let active = true

    getPlatformConfig()
      .then(data => {
        if (!active) return
        setConfig(data)
        setRate(String(data.taxa_percentual ?? ''))
      })
      .catch(error =>
        toast.error(
          error.message ||
            'Não foi possível carregar a taxa da plataforma.'
        )
      )
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  if (!['adm', 'ceo'].includes(level)) return null

  const save = async () => {
    const numeric = Number(rate)

    if (
      !Number.isFinite(numeric) ||
      numeric < 0 ||
      numeric > 100
    ) {
      return toast.error(
        'A taxa precisa estar entre 0% e 100%.'
      )
    }

    setSaving(true)

    try {
      const updated = await updatePlatformConfig(numeric)
      setConfig(updated)
      setRate(String(updated.taxa_percentual))
      toast.success('Taxa da plataforma atualizada.')
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível atualizar a taxa.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-purple-100 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-purple-100 p-2 text-purple-700">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-heading text-lg font-bold text-[#0D1273]">
                Configuração da plataforma
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Taxa retida do valor dos produtos vendidos. Ela não é adicionada ao total pago pelo comprador.
              </p>

              {config?.atualizado_em && (
                <p className="mt-1 text-xs text-gray-400">
                  Atualizada em{' '}
                  {new Date(config.atualizado_em).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          <div className="w-full md:w-80">
            <Label>Taxa da plataforma (%)</Label>

            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <Input
                  className="pl-10"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rate}
                  onChange={event =>
                    setRate(event.target.value)
                  }
                  disabled={loading || level !== 'ceo'}
                />
              </div>

              {level === 'ceo' && (
                <Button
                  onClick={save}
                  disabled={saving || loading}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </Button>
              )}
            </div>

            <p className="mt-2 text-xs text-gray-400">
              {level === 'ceo'
                ? 'CEO pode editar a taxa.'
                : 'ADM possui acesso somente para leitura.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
