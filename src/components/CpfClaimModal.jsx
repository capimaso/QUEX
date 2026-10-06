import React, { useEffect, useState } from 'react'
import { FileWarning, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { submitCpfClaim } from '@/api/data'

function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export default function CpfClaimModal({
  open,
  onClose,
  cpf,
  initialEmail = '',
  initialPhone = '',
}) {
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(initialPhone)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail)
    setPhone(initialPhone)
    setReason('')
    setLoading(false)
    setTicket(null)
  }, [open, initialEmail, initialPhone, cpf])

  if (!open) return null

  const submit = async event => {
    event.preventDefault()

    if (reason.trim().length < 10) {
      return toast.error('Explique o motivo da reivindicação com um pouco mais de detalhe.')
    }

    setLoading(true)
    try {
      const result = await submitCpfClaim({
        cpf,
        email: email.trim().toLowerCase(),
        phone,
        reason: reason.trim(),
      })
      setTicket(result.ticket)
      toast.success(`Solicitação ${result.ticket.label} criada.`)
    } catch (error) {
      toast.error(error.message || 'Não foi possível criar a reivindicação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !loading) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <FileWarning className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-[#0D1273]">Reivindicar CPF</h2>
              <p className="mt-1 text-sm text-gray-500">CPF identificado: {formatCpf(cpf)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {ticket ? (
          <div className="px-6 py-7 text-center">
            <h3 className="font-semibold text-[#0D1273]">Solicitação registrada</h3>
            <p className="mt-2 text-3xl font-bold text-[#0D1273]">{ticket.label}</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Esse número identifica o ticket especial de reivindicação que será
              analisado pela administração.
            </p>
            <Button className="mt-6" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-6 py-5">
            <div>
              <Label>E-mail para contato</Label>
              <Input
                className="mt-1.5"
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                className="mt-1.5"
                required
                inputMode="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="(48) 99999-9999"
              />
            </div>

            <div>
              <Label>Motivo da reivindicação</Label>
              <Textarea
                className="mt-1.5"
                rows={5}
                maxLength={1000}
                required
                value={reason}
                onChange={event => setReason(event.target.value)}
                placeholder="Explique por que você acredita que esse CPF pertence a você e precisa recuperar a conta."
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : (
                  'Enviar reivindicação'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
