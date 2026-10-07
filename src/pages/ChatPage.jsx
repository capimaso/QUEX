import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  CheckCheck,
  Flag,
  Loader2,
  Send,
} from 'lucide-react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getChatMessages,
  sendPrivateChatMessage,
} from '@/api/module12'
import ReportModal from '@/components/ReportModal'
import {
  Button,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function ChatPage() {
  const { chat_id: chatId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)

  const bottomRef = useRef(null)

  const load = async ({
    silent = false,
  } = {}) => {
    try {
      const data = await getChatMessages(chatId)
      setChat(data.chat || null)
      setMessages(data.messages || [])

      if (!silent) {
        window.setTimeout(() => {
          bottomRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
          })
        }, 50)
      }
    } catch (error) {
      if (error.status === 401) {
        navigate('/login', { replace: true })
        return
      }

      if (error.status === 403 || error.status === 404) {
        toast.error('Você não pode acessar este chat.')
        navigate('/', { replace: true })
        return
      }

      if (!silent) {
        toast.error(
          error.message ||
            'Não foi possível carregar o chat.'
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return

    let active = true

    const initial = async () => {
      if (!active) return
      await load()
    }

    initial()

    const interval = window.setInterval(() => {
      if (active) {
        load({ silent: true })
      }
    }, 4000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [chatId, user?.id])

  useEffect(() => {
    if (!messages.length) return

    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages.length])

  const title = useMemo(
    () =>
      chat?.counterpart_name
        ? `Conversa com ${chat.counterpart_name}`
        : 'Chat do pedido',
    [chat]
  )

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D1273]" />
      </div>
    )
  }

  if (!chat) return null

  const send = async event => {
    event.preventDefault()

    const text = message.trim()
    if (!text) return

    setSending(true)

    try {
      await sendPrivateChatMessage(chatId, text)

      setMessage('')
      await load()
    } catch (error) {
      // O texto NÃO é apagado quando o anti-contato bloquear.
      toast.error(
        error.message ||
          'Não foi possível enviar a mensagem.'
      )
    } finally {
      setSending(false)
    }
  }

  const reportMessage = item => {
    setReportTarget({
      reportedUserId: item.remetente_id,
      messageId: item.id,
      contextLabel: `Chat do pedido #${chat.pedido_id}`,
      contextDescription:
        `Mensagem denunciada no chat do pedido #${chat.pedido_id}: ${item.mensagem}`,
    })
  }

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100vh-180px)] max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-start gap-3">
          <Link
            to={
              user.role === 'seller'
                ? '/seller/dashboard'
                : `/orders/${chat.pedido_id}`
            }
            className="mt-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-[#0D1273]"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            <h1 className="text-2xl font-heading font-bold text-[#0D1273]">
              {title}
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              Pedido #{chat.pedido_id} · mantenha a negociação dentro do QUÉX
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50/70 p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                Nenhuma mensagem ainda. Comece a conversa por aqui.
              </div>
            ) : (
              messages.map(item => {
                const mine =
                  Number(item.remetente_id) === Number(user.id)

                return (
                  <div
                    key={item.id}
                    className={`flex ${
                      mine
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${
                        mine
                          ? 'bg-[#0D1273] text-white'
                          : 'border border-gray-100 bg-white text-gray-700'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span
                          className={`text-xs font-semibold ${
                            mine
                              ? 'text-white/80'
                              : 'text-[#0D1273]'
                          }`}
                        >
                          {mine
                            ? 'Você'
                            : item.remetente_nome}
                        </span>

                        {!mine && (
                          <button
                            type="button"
                            onClick={() =>
                              reportMessage(item)
                            }
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Denunciar mensagem"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {item.mensagem}
                      </p>

                      <div
                        className={`mt-2 flex items-center justify-end gap-1 text-[10px] ${
                          mine
                            ? 'text-white/60'
                            : 'text-gray-400'
                        }`}
                      >
                        <span>{formatDate(item.data_envio)}</span>

                        {mine && item.lida && (
                          <CheckCheck className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={send}
            className="border-t border-gray-100 bg-white p-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={message}
                  onChange={event =>
                    setMessage(event.target.value)
                  }
                  placeholder="Digite uma mensagem..."
                  className="min-h-[48px] resize-none"
                />

                <p className="mt-1 text-[11px] text-gray-400">
                  Telefone, e-mail, links e redes sociais são bloqueados automaticamente.
                </p>
              </div>

              <Button
                type="submit"
                className="h-12 shrink-0"
                disabled={
                  sending ||
                  !message.trim()
                }
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        reporterId={user.id}
        reportedUserId={reportTarget?.reportedUserId}
        messageId={reportTarget?.messageId}
        contextType="chat"
        contextLabel={reportTarget?.contextLabel}
        contextDescription={reportTarget?.contextDescription}
        initialCategory="conteudo_ofensivo"
      />
    </>
  )
}
