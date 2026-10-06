import React, { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  Loader2,
  MessageCircleQuestion,
  Send,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Label, Select, Textarea } from '@/components/ui'
import { createSupportTicket } from '@/api/data'
import { useAuth } from '@/lib/AuthContext'

const FAQ = [
  {
    question: 'Como compro um peixe?',
    answer:
      'Abra o Marketplace, escolha um produto, confira o anúncio e adicione a quantidade desejada ao carrinho.',
  },
  {
    question: 'Como vendo meu produto?',
    answer:
      'Entre com uma conta de vendedor e use as opções da sua loja para cadastrar e gerenciar seus produtos.',
  },
  {
    question: 'Como faço uma reclamação?',
    answer:
      'Você pode usar o botão Denunciar em um perfil ou produto. Para outros problemas, abra um ticket na aba Chat de Suporte.',
  },
  {
    question: 'Como acompanho meu pedido?',
    answer:
      'Abra o menu do seu usuário e clique em Pedidos para conferir o status e as informações da entrega.',
  },
]

const REASONS = [
  ['problema_pedido', 'Problema com pedido'],
  ['problema_pagamento', 'Problema com pagamento'],
  ['problema_vendedor', 'Problema com vendedor'],
  ['problema_comprador', 'Problema com comprador'],
  ['duvida_geral', 'Dúvida geral'],
  ['outros', 'Outros'],
]

export default function SupportWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState(user ? 'faq' : 'chat')
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [createdTicket, setCreatedTicket] = useState(null)

  useEffect(() => {
    if (!user) setTab('chat')
  }, [user])

  const submit = async event => {
    event.preventDefault()
    if (!reason) return toast.error('Escolha o motivo do atendimento.')
    if (message.trim().length < 5) {
      return toast.error('Escreva uma mensagem com um pouco mais de detalhe.')
    }

    setSending(true)
    try {
      const result = await createSupportTicket({
        reason,
        message: message.trim(),
      })
      setCreatedTicket(result.ticket)
      setReason('')
      setMessage('')
      toast.success(`Ticket ${result.ticket.label} criado.`)
    } catch (error) {
      toast.error(error.message || 'Não foi possível abrir o ticket.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[70] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-[#0D1273] p-2 text-white">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-[#0D1273]">Suporte QUÉX</h2>
                <p className="text-xs text-gray-400">
                  {user ? 'FAQ e abertura de tickets' : 'Atendimento por ticket'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar suporte"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {user && (
            <div className="grid grid-cols-2 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setTab('faq')}
                className={`px-3 py-3 text-sm font-medium ${
                  tab === 'faq'
                    ? 'border-b-2 border-[#0D1273] text-[#0D1273]'
                    : 'text-gray-500'
                }`}
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={() => setTab('chat')}
                className={`px-3 py-3 text-sm font-medium ${
                  tab === 'chat'
                    ? 'border-b-2 border-[#0D1273] text-[#0D1273]'
                    : 'text-gray-500'
                }`}
              >
                Chat de Suporte
              </button>
            </div>
          )}

          <div className="max-h-[65vh] overflow-y-auto p-4">
            {user && tab === 'faq' ? (
              <div className="space-y-2">
                {FAQ.map((item, index) => {
                  const expanded = expandedFaq === index
                  return (
                    <div key={item.question} className="overflow-hidden rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expanded ? null : index)}
                        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left text-sm font-medium text-[#0D1273]"
                      >
                        <span>{item.question}</span>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                      {expanded && (
                        <p className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : createdTicket ? (
              <div className="py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <Send className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-[#0D1273]">Ticket aberto com sucesso</h3>
                <p className="mt-2 text-2xl font-bold text-[#0D1273]">{createdTicket.label}</p>
                <p className="mt-2 text-sm text-gray-500">
                  Guarde esse número para identificar seu atendimento.
                </p>
                <Button variant="outline" className="mt-5" onClick={() => setCreatedTicket(null)}>
                  Abrir outro ticket
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {user && (
                  <div>
                    <Label>Nome</Label>
                    <Input className="mt-1.5 bg-gray-50" value={user.full_name || 'Usuário'} disabled />
                  </div>
                )}

                {!user && (
                  <div className="rounded-xl bg-[#5A5FBF]/5 p-3 text-xs leading-relaxed text-gray-600">
                    Você está abrindo um ticket como visitante. Para vincular o atendimento
                    à sua conta, entre no QUÉX antes de abrir o ticket.
                  </div>
                )}

                <div>
                  <Label>Motivo</Label>
                  <Select
                    className="mt-1.5"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    required
                  >
                    <option value="">Selecione um motivo</option>
                    {REASONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label>Mensagem</Label>
                    <span className="text-xs text-gray-400">{message.length}/2000</span>
                  </div>
                  <Textarea
                    rows={5}
                    maxLength={2000}
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    placeholder="Explique como podemos ajudar..."
                    required
                  />
                </div>

                <Button className="w-full" disabled={sending}>
                  {sending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Abrindo ticket...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" />Abrir ticket</>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-[#0D1273] text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
        aria-label={open ? 'Fechar suporte' : 'Abrir suporte'}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircleQuestion className="h-6 w-6" />}
      </button>
    </>
  )
}
