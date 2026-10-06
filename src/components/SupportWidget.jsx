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
import {
  createSupportTicket,
  getMySupportTicket,
  listMySupportTickets,
  sendSupportMessage,
} from '@/api/data'
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
  const [activeTicket, setActiveTicket] =
    useState(null)

  const [chatLoading, setChatLoading] =
    useState(false)

  const [chatMessage, setChatMessage] =
    useState('')

  const [chatSending, setChatSending] =
    useState(false)

  useEffect(() => {
    if (!user) setTab('chat')
  }, [user])

  useEffect(() => {
    if (
      open &&
      user &&
      tab === 'chat'
    ) {
      loadActiveTicket()
    }
  }, [open, user, tab])

  const loadActiveTicket =
    async () => {
      if (!user) {
        setActiveTicket(null)
        return
      }

      setChatLoading(true)

      try {
        const tickets =
          await listMySupportTickets()

        const active =
          tickets.find(
            ticket =>
              ticket.status ===
                'aberto' ||
              ticket.status ===
                'respondido'
          )

        if (!active) {
          setActiveTicket(null)
          return
        }

        const detail =
          await getMySupportTicket(
            active.id
          )

        setActiveTicket(detail)
      } catch (error) {
        console.error(
          '[QUÉX] erro ao carregar ticket:',
          error
        )
      } finally {
        setChatLoading(false)
      }
    }
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
      const detail =
        await getMySupportTicket(
          result.ticket.id
        )

      setActiveTicket(detail)
      setReason('')
      setMessage('')
      toast.success(`Ticket ${result.ticket.label} criado.`)
    } catch (error) {
      toast.error(error.message || 'Não foi possível abrir o ticket.')
    } finally {
      setSending(false)
    }
  }

  const sendChatMessage =
    async event => {
      event.preventDefault()

      if (
        !activeTicket?.ticket?.id
      ) {
        return
      }

      if (!chatMessage.trim()) {
        return
      }

      setChatSending(true)

      try {
        await sendSupportMessage(
          activeTicket.ticket.id,
          chatMessage
        )

        setChatMessage('')

        const refreshed =
          await getMySupportTicket(
            activeTicket.ticket.id
          )

        setActiveTicket(
          refreshed
        )
      } catch (error) {
        toast.error(
          error.message ||
            'Não foi possível enviar a mensagem.'
        )
      } finally {
        setChatSending(false)
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
            ) : chatLoading ? (

              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#0D1273]" />
              </div>

            ) : activeTicket ? (

              <div className="support-chat flex h-[430px] flex-col overflow-hidden">

                {/* CABEÇALHO */}
                <div className="border-b border-gray-100 pb-3">

                  <div className="flex items-center justify-between gap-2">

                    <div>
                      <p className="font-semibold text-[#0D1273]">
                        {activeTicket.ticket.label}
                      </p>

                      <p className="text-xs text-gray-400">
                        {
                          REASONS.find(
                            ([value]) =>
                              value ===
                              activeTicket.ticket
                                .motivo
                          )?.[1] ||
                          activeTicket.ticket.motivo
                        }
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        activeTicket.ticket
                          .status === 'respondido'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {activeTicket.ticket
                        .status === 'respondido'
                        ? 'Respondido'
                        : 'Aberto'}
                    </span>

                  </div>

                </div>


                {/* MENSAGENS */}
                <div className="support-chat-messages flex-1 space-y-2 overflow-y-auto py-4">

                  {activeTicket.messages.map(
                    item => (
                      <div
                        key={item.id}
                        className={`flex ${
                          item.is_adm
                            ? 'justify-start'
                            : 'justify-end'
                        }`}
                      >

                        <div
                          className={
                            item.is_adm
                              ? 'support-bubble support-bubble-admin'
                              : 'support-bubble support-bubble-user'
                          }
                        >

                          <p className="mb-1 text-[10px] font-semibold opacity-70">
                            {item.is_adm
                              ? 'Suporte QUÉX'
                              : 'Você'}
                          </p>

                          <p className="whitespace-pre-wrap break-words text-sm">
                            {item.mensagem}
                          </p>

                          <p className="mt-1 text-right text-[9px] opacity-60">
                            {new Date(
                              item.data_envio
                            ).toLocaleString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </p>

                        </div>

                      </div>
                    )
                  )}

                </div>


                {/* CAMPO */}
                <form
                  onSubmit={sendChatMessage}
                  className="border-t border-gray-100 pt-3"
                >

                  <div className="flex items-end gap-2">

                    <Textarea
                      rows={2}
                      maxLength={2000}
                      value={chatMessage}
                      onChange={event =>
                        setChatMessage(
                          event.target.value
                        )
                      }
                      placeholder="Digite sua mensagem..."
                      className="min-h-[44px] flex-1 resize-none"
                    />

                    <Button
                      type="submit"
                      disabled={
                        chatSending ||
                        !chatMessage.trim()
                      }
                      className="h-11 shrink-0 px-3"
                    >
                      {chatSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>

                  </div>

                </form>

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
