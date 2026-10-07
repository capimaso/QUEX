import React, { useEffect, useState } from 'react'
import {
  Ban,
  Flag,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { banAdminUser } from '@/api/admin'
import {
  listAdminMessageReports,
  removeReportedChatMessage,
} from '@/api/module12'
import {
  Badge,
  Button,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function MessageReportsPanel() {
  const { user } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionId, setActionId] = useState(null)

  const level = String(
    user?.access_level || 'comum'
  ).toLowerCase()

  const load = async silent => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const rows = await listAdminMessageReports()
      setReports(rows)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível carregar as denúncias.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!['adm', 'ceo'].includes(level)) return
    load(false)
  }, [level])

  if (!['adm', 'ceo'].includes(level)) return null

  const removeMessage = async report => {
    if (!report.message_id) return

    if (
      !window.confirm(
        'Remover esta mensagem do chat? Ela deixará de aparecer para comprador e vendedor.'
      )
    ) {
      return
    }

    setActionId(report.id)

    try {
      await removeReportedChatMessage(report.message_id)
      toast.success('Mensagem removida do chat.')
      await load(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível remover a mensagem.'
      )
    } finally {
      setActionId(null)
    }
  }

  const banUser = async report => {
    if (
      !window.confirm(
        `Banir ${report.reported_user_name}? A regra de permissões do Módulo 8 será aplicada.`
      )
    ) {
      return
    }

    setActionId(report.id)

    try {
      await banAdminUser(
        report.reported_user_id,
        `Denúncia #${report.id}: ${report.description || report.category}`
      )

      toast.success('Usuário banido.')
      await load(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível banir o usuário.'
      )
    } finally {
      setActionId(null)
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-red-100 bg-white p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-50 p-2 text-red-600">
              <Flag className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-heading text-lg font-bold text-[#0D1273]">
                Denúncias e mensagens
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Revisão de conteúdo denunciado em chats, Q&A, anúncios e perfis.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#0D1273]" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-400">
            Nenhuma denúncia registrada.
          </div>
        ) : (
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {reports.map(report => (
              <article
                key={report.id}
                className="rounded-xl border border-gray-100 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#0D1273]">
                        Denúncia #{report.id}
                      </span>

                      <Badge className="bg-red-50 text-red-700">
                        {report.category}
                      </Badge>

                      {report.message_removed && (
                        <Badge className="bg-gray-100 text-gray-600">
                          Mensagem removida
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(report.created_at)} · denunciado: {report.reported_user_name}
                    </p>
                  </div>
                </div>

                {report.message_text && (
                  <div className="mt-3 rounded-xl bg-red-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                      Mensagem denunciada
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">
                      {report.message_text}
                    </p>
                  </div>
                )}

                {report.description && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-gray-600">
                      {report.description}
                    </p>
                  </div>
                )}

                {report.product_id && (
                  <p className="mt-3 text-xs text-gray-400">
                    Produto #{report.product_id}
                    {report.product_name
                      ? ` · ${report.product_name}`
                      : ''}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {report.message_id && !report.message_removed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMessage(report)}
                      disabled={actionId === report.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover mensagem
                    </Button>
                  )}

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => banUser(report)}
                    disabled={actionId === report.id}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Banir usuário
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
