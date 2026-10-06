import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileWarning,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '@/components/AuthLayout'
import {
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui'
import { submitCpfClaim } from '@/api/data'

function formatCpf(value) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export default function ClaimCpf() {
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)

  const submit = async event => {
    event.preventDefault()

    const cleanCpf = cpf.replace(/\D/g, '')

    if (cleanCpf.length !== 11) {
      return toast.error('Informe um CPF válido.')
    }

    if (reason.trim().length < 10) {
      return toast.error(
        'Explique o motivo da reivindicação com um pouco mais de detalhe.'
      )
    }

    setLoading(true)

    try {
      const result = await submitCpfClaim({
        cpf: cleanCpf,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        reason: reason.trim(),
      })

      setTicket(result.ticket)

      toast.success(
        `Solicitação ${result.ticket.label} criada.`
      )
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível enviar a reivindicação.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (ticket) {
    return (
      <AuthLayout
        icon={FileWarning}
        title="Solicitação registrada"
        subtitle="Sua reivindicação foi enviada para análise."
        footer={
          <Link
            to="/login"
            className="text-[#0D1273] font-medium hover:underline"
          >
            Voltar para o login
          </Link>
        }
      >
        <div className="py-5 text-center">
          <p className="text-sm text-gray-500">
            Número do atendimento
          </p>

          <p className="mt-2 text-4xl font-bold text-[#0D1273]">
            {ticket.label}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-gray-500">
            Guarde esse número. A administração do QUÉX analisará
            a reivindicação do CPF informado.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      icon={FileWarning}
      title="Reivindicar CPF"
      subtitle="Use esta opção se seu CPF já aparece cadastrado no QUÉX."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center text-[#0D1273] font-medium hover:underline"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar ao login
        </Link>
      }
    >
      <div className="mb-5 rounded-xl bg-[#5A5FBF]/5 p-3 text-sm leading-relaxed text-gray-600">
        Esta solicitação não dá acesso automático à conta. Os dados serão
        enviados para análise da administração antes de qualquer alteração.
      </div>

      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <div>
          <Label>CPF</Label>

          <Input
            className="mt-1.5"
            value={cpf}
            onChange={event =>
              setCpf(
                formatCpf(event.target.value)
              )
            }
            inputMode="numeric"
            placeholder="000.000.000-00"
            required
          />
        </div>

        <div>
          <Label>E-mail para contato</Label>

          <Input
            className="mt-1.5"
            type="email"
            value={email}
            onChange={event =>
              setEmail(event.target.value)
            }
            placeholder="voce@email.com"
            required
          />
        </div>

        <div>
          <Label>Telefone</Label>

          <Input
            className="mt-1.5"
            value={phone}
            onChange={event =>
              setPhone(event.target.value)
            }
            inputMode="tel"
            placeholder="(48) 99999-9999"
            required
          />
        </div>

        <div>
          <Label>
            Motivo da reivindicação
          </Label>

          <Textarea
            className="mt-1.5"
            rows={5}
            maxLength={1000}
            value={reason}
            onChange={event =>
              setReason(event.target.value)
            }
            placeholder="Explique por que você precisa recuperar a conta vinculada a esse CPF..."
            required
          />
        </div>

        <Button
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar reivindicação'
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}
