import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  TicketCheck,
  UserRoundCog,
  X,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  approveAdminClaim,
  banAdminUser,
  getAdminTicket,
  listAdminClaims,
  listAdminTickets,
  listAdminUsers,
  rejectAdminClaim,
  replyAdminTicket,
  setAdminTicketStatus,
} from '@/api/admin'
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const REASON_LABELS = {
  problema_pedido: 'Problema com pedido',
  problema_pagamento: 'Problema com pagamento',
  problema_vendedor: 'Problema com vendedor',
  problema_comprador: 'Problema com comprador',
  duvida_geral: 'Dúvida geral',
  outros: 'Outros',
  reivindicacao_cpf: 'Reivindicação de CPF',
}

const TICKET_STATUS_LABELS = {
  aberto: 'Aberto',
  respondido: 'Respondido',
  fechado: 'Fechado',
}

const CLAIM_STATUS_LABELS = {
  aberta: 'Pendente',
  em_analise: 'Pendente',
  aprovada: 'Aprovada',
  recusada: 'Rejeitada',
}

const ACCESS_LABELS = {
  comum: 'Comum',
  adm: 'ADM',
  ceo: 'CEO',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    }
  ).format(date)
}

function formatCpf(value) {
  const digits = String(
    value || ''
  )
    .replace(/\D/g, '')
    .slice(0, 11)

  if (digits.length !== 11) {
    return value || '—'
  }

  return digits.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    '$1.$2.$3-$4'
  )
}

function ticketStatusClass(status) {
  if (status === 'aberto') {
    return 'bg-amber-100 text-amber-700'
  }

  if (status === 'respondido') {
    return 'bg-blue-100 text-blue-700'
  }

  return 'bg-gray-100 text-gray-600'
}

function claimStatusClass(status) {
  if (
    status === 'aberta' ||
    status === 'em_analise'
  ) {
    return 'bg-amber-100 text-amber-700'
  }

  if (status === 'aprovada') {
    return 'bg-green-100 text-green-700'
  }

  return 'bg-red-100 text-red-700'
}

function AccessBadge({ level }) {
  const value =
    String(level || 'comum')
      .toLowerCase()

  const classes =
    value === 'ceo'
      ? 'bg-purple-100 text-purple-700'
      : value === 'adm'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-600'

  return (
    <Badge className={classes}>
      {ACCESS_LABELS[value] || 'Comum'}
    </Badge>
  )
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={event => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        className={`max-h-[90vh] w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ${
          wide
            ? 'max-w-4xl'
            : 'max-w-xl'
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-heading font-bold text-[#0D1273]">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] =
    useState('tickets')

  const [tickets, setTickets] =
    useState([])
  const [claims, setClaims] =
    useState([])
  const [users, setUsers] =
    useState([])

  const [loading, setLoading] =
    useState(true)
  const [refreshing, setRefreshing] =
    useState(false)

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState(null)
  const [
    ticketLoading,
    setTicketLoading,
  ] = useState(false)
  const [reply, setReply] =
    useState('')
  const [
    replying,
    setReplying,
  ] = useState(false)

  const [
    selectedUser,
    setSelectedUser,
  ] = useState(null)
  const [
    confirmBan,
    setConfirmBan,
  ] = useState(false)
  const [
    banReason,
    setBanReason,
  ] = useState('')
  const [
    banning,
    setBanning,
  ] = useState(false)

  const [
    selectedClaim,
    setSelectedClaim,
  ] = useState(null)
  const [
    rejectionReason,
    setRejectionReason,
  ] = useState('')
  const [
    decidingClaim,
    setDecidingClaim,
  ] = useState(false)

  const [search, setSearch] =
    useState('')

  const accessLevel = String(
    user?.access_level || 'comum'
  ).toLowerCase()

  const loadAll = async (
    silent = false
  ) => {
    if (!silent) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const [
        ticketRows,
        claimRows,
        userRows,
      ] = await Promise.all([
        listAdminTickets(),
        listAdminClaims(),
        listAdminUsers(),
      ])

      setTickets(ticketRows)
      setClaims(claimRows)
      setUsers(userRows)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível carregar o painel.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const ticketCounts = useMemo(
    () => ({
      aberto: tickets.filter(
        item => item.status === 'aberto'
      ).length,
      respondido: tickets.filter(
        item =>
          item.status === 'respondido'
      ).length,
      fechado: tickets.filter(
        item =>
          item.status === 'fechado'
      ).length,
    }),
    [tickets]
  )

  const pendingClaims =
    claims.filter(
      item =>
        item.status === 'aberta' ||
        item.status === 'em_analise'
    ).length

  const activeUsers =
    users.filter(
      item =>
        item.is_active &&
        !item.banido_em
    ).length

  const normalizedSearch =
    search.trim().toLowerCase()

  const filteredTickets =
    tickets.filter(ticket => {
      if (!normalizedSearch) {
        return true
      }

      return [
        ticket.label,
        ticket.usuario_nome,
        ticket.usuario_email,
        REASON_LABELS[
          ticket.motivo
        ] || ticket.motivo,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedSearch)
      )
    })

  const filteredClaims =
    claims.filter(claim => {
      if (!normalizedSearch) {
        return true
      }

      return [
        claim.cpf,
        claim.email,
        claim.telefone,
        claim.motivo,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedSearch)
      )
    })

  const filteredUsers =
    users.filter(item => {
      if (!normalizedSearch) {
        return true
      }

      return [
        item.nome,
        item.email,
        item.tipo,
        item.nivel_acesso,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(normalizedSearch)
      )
    })

  const openTicket = async id => {
    setTicketLoading(true)
    setReply('')

    try {
      const data =
        await getAdminTicket(id)

      setSelectedTicket(data)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível abrir o ticket.'
      )
    } finally {
      setTicketLoading(false)
    }
  }

  const refreshTicket = async id => {
    const data =
      await getAdminTicket(id)

    setSelectedTicket(data)
  }

  const sendReply = async event => {
    event.preventDefault()

    if (
      !selectedTicket?.ticket?.id
    ) {
      return
    }

    if (!reply.trim()) {
      return toast.error(
        'Digite uma resposta.'
      )
    }

    setReplying(true)

    try {
      await replyAdminTicket(
        selectedTicket.ticket.id,
        reply.trim()
      )

      setReply('')
      await Promise.all([
        refreshTicket(
          selectedTicket.ticket.id
        ),
        loadAll(true),
      ])

      toast.success(
        'Resposta enviada.'
      )
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível responder.'
      )
    } finally {
      setReplying(false)
    }
  }

  const changeTicketStatus =
    async status => {
      const id =
        selectedTicket?.ticket?.id

      if (!id) return

      try {
        await setAdminTicketStatus(
          id,
          status
        )

        await Promise.all([
          refreshTicket(id),
          loadAll(true),
        ])

        toast.success(
          'Status atualizado.'
        )
      } catch (error) {
        toast.error(
          error.message ||
            'Não foi possível alterar o status.'
        )
      }
    }

  const banUser = async () => {
    if (!selectedUser?.id) return

    setBanning(true)

    try {
      await banAdminUser(
        selectedUser.id,
        banReason.trim() ||
          'Banimento administrativo'
      )

      toast.success(
        'Usuário banido e anúncios desativados.'
      )

      setSelectedUser(null)
      setConfirmBan(false)
      setBanReason('')
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível banir o usuário.'
      )
    } finally {
      setBanning(false)
    }
  }

  const approveClaim = async () => {
    if (!selectedClaim?.id) return

    setDecidingClaim(true)

    try {
      await approveAdminClaim(
        selectedClaim.id
      )

      toast.success(
        'Reivindicação aprovada. E-mail e telefone da conta foram atualizados.'
      )

      setSelectedClaim(null)
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível aprovar a reivindicação.'
      )
    } finally {
      setDecidingClaim(false)
    }
  }

  const rejectClaim = async () => {
    if (!selectedClaim?.id) return

    setDecidingClaim(true)

    try {
      await rejectAdminClaim(
        selectedClaim.id,
        rejectionReason.trim()
      )

      toast.success(
        'Reivindicação rejeitada.'
      )

      setSelectedClaim(null)
      setRejectionReason('')
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível rejeitar a reivindicação.'
      )
    } finally {
      setDecidingClaim(false)
    }
  }

  const tabs = [
    {
      id: 'tickets',
      label: 'Tickets de Suporte',
      icon: MessageSquareText,
      count: tickets.length,
    },
    {
      id: 'claims',
      label: 'Reivindicações de CPF',
      icon: TicketCheck,
      count: pendingClaims,
    },
    {
      id: 'users',
      label: 'Usuários',
      icon: UserRoundCog,
      count: users.length,
    },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#0D1273]" />
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#5A5FBF]">
              <ShieldCheck className="h-4 w-4" />
              Área restrita • {accessLevel.toUpperCase()}
            </div>

            <h1 className="text-3xl font-heading font-bold text-[#0D1273]">
              Painel Administrativo
            </h1>

            <p className="mt-2 text-gray-500">
              Atendimento, reivindicações e gerenciamento de usuários do QUÉX.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              loadAll(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                refreshing
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Atualizar
          </Button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">Tickets abertos</p>
            <p className="mt-1 text-2xl font-bold text-[#0D1273]">{ticketCounts.aberto}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">Respondidos</p>
            <p className="mt-1 text-2xl font-bold text-[#0D1273]">{ticketCounts.respondido}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">CPF pendentes</p>
            <p className="mt-1 text-2xl font-bold text-[#0D1273]">{pendingClaims}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm text-gray-500">Usuários ativos</p>
            <p className="mt-1 text-2xl font-bold text-[#0D1273]">{activeUsers}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabs.map(tab => {
                  const Icon = tab.icon
                  const active =
                    activeTab === tab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab.id)
                        setSearch('')
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-[#0D1273] text-white'
                          : 'text-gray-600 hover:bg-[#5A5FBF]/10 hover:text-[#0D1273]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          active
                            ? 'bg-white/15'
                            : 'bg-gray-100'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  value={search}
                  onChange={event =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar..."
                />
              </div>
            </div>
          </div>

          {activeTab === 'tickets' && (
            <div className="divide-y divide-gray-100">
              {filteredTickets.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  Nenhum ticket encontrado.
                </div>
              ) : (
                filteredTickets.map(ticket => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() =>
                      openTicket(ticket.id)
                    }
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#5A5FBF]/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5A5FBF]/10 text-[#0D1273]">
                      <MessageSquareText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0D1273]">{ticket.label}</span>
                        <Badge className={ticketStatusClass(ticket.status)}>
                          {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                        </Badge>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-600">
                        {ticket.usuario_nome} • {REASON_LABELS[ticket.motivo] || ticket.motivo}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(ticket.data_criacao)}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="divide-y divide-gray-100">
              {filteredClaims.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  Nenhuma reivindicação encontrada.
                </div>
              ) : (
                filteredClaims.map(claim => (
                  <button
                    key={claim.id}
                    type="button"
                    onClick={() => {
                      setSelectedClaim(claim)
                      setRejectionReason('')
                    }}
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#5A5FBF]/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <TicketCheck className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0D1273]">{formatCpf(claim.cpf)}</span>
                        <Badge className={claimStatusClass(claim.status)}>
                          {CLAIM_STATUS_LABELS[claim.status] || claim.status}
                        </Badge>
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-600">
                        {claim.email} • {claim.telefone}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {formatDate(claim.data_criacao)}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  Nenhum usuário encontrado.
                </div>
              ) : (
                filteredUsers.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(item)
                      setConfirmBan(false)
                      setBanReason('')
                    }}
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#5A5FBF]/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5A5FBF]/10 text-[#0D1273]">
                      <CircleUserRound className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#0D1273]">{item.nome}</span>
                        <AccessBadge level={item.nivel_acesso} />
                        {item.banido_em && (
                          <Badge className="bg-red-100 text-red-700">Banido</Badge>
                        )}
                      </div>

                      <p className="mt-1 truncate text-sm text-gray-600">{item.email}</p>

                      <p className="mt-1 text-xs text-gray-400">
                        {item.tipo === 'vendedor' ? 'Vendedor' : 'Comprador'} • cadastro {formatDate(item.data_criacao)}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {ticketLoading && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {selectedTicket && (
        <Modal
          wide
          title={`${selectedTicket.ticket.label} • ${REASON_LABELS[selectedTicket.ticket.motivo] || selectedTicket.ticket.motivo}`}
          subtitle={`${selectedTicket.ticket.usuario_nome} • aberto em ${formatDate(selectedTicket.ticket.data_criacao)}`}
          onClose={() => setSelectedTicket(null)}
        >
          <div className="mb-5 flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
              <p className="mt-1 text-sm font-medium text-[#0D1273]">
                {TICKET_STATUS_LABELS[selectedTicket.ticket.status]}
              </p>
            </div>

            <Select
              className="sm:w-52"
              value={selectedTicket.ticket.status}
              onChange={event =>
                changeTicketStatus(event.target.value)
              }
            >
              <option value="aberto">Aberto</option>
              <option value="respondido">Respondido</option>
              <option value="fechado">Fechado</option>
            </Select>
          </div>

          <div className="flex h-[600px] max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[#efeae2] admin-chat-area">

          {/* TOPO DO CHAT */}
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 admin-chat-header">
            <div>
              <p className="font-semibold text-[#0D1273]">
                {selectedTicket.ticket.usuario_nome}
              </p>

              <p className="text-xs text-gray-500">
                {REASON_LABELS[selectedTicket.ticket.motivo] ||
                  selectedTicket.ticket.motivo}
              </p>
            </div>

            <Select
              className="w-40"
              value={selectedTicket.ticket.status}
              onChange={event =>
                changeTicketStatus(event.target.value)
              }
            >
              <option value="aberto">
                Aberto
              </option>

              <option value="respondido">
                Respondido
              </option>

              <option value="fechado">
                Fechado
              </option>
            </Select>
          </div>

          {/* HISTÓRICO */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">

            {selectedTicket.messages.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Nenhuma mensagem neste ticket.
              </div>
            ) : (
              selectedTicket.messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.is_adm
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={
                      message.is_adm
                        ? 'admin-chat-bubble admin-chat-bubble-adm'
                        : 'admin-chat-bubble admin-chat-bubble-user'
                    }
                  >
                    <p className="mb-1 text-xs font-semibold opacity-70">
                      {message.is_adm
                        ? 'Administração QUÉX'
                        : message.autor_nome}
                    </p>

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.mensagem}
                    </p>

                    <p className="mt-1 text-right text-[10px] opacity-60">
                      {formatDate(message.data_envio)}
                    </p>
                  </div>
                </div>
              ))
            )}

          </div>

          {/* CAMPO DE RESPOSTA */}
          <form
            onSubmit={sendReply}
            className="border-t border-gray-200 bg-white p-3 admin-chat-footer"
          >
            <div className="flex items-end gap-2">

              <Textarea
                rows={2}
                maxLength={2000}
                value={reply}
                onChange={event =>
                  setReply(event.target.value)
                }
                disabled={
                  selectedTicket.ticket.status ===
                  'fechado'
                }
                placeholder={
                  selectedTicket.ticket.status ===
                  'fechado'
                    ? 'Reabra o ticket para responder.'
                    : 'Digite uma mensagem...'
                }
                className="min-h-[46px] flex-1 resize-none"
              />

              <Button
                type="submit"
                disabled={
                  replying ||
                  !reply.trim() ||
                  selectedTicket.ticket.status ===
                    'fechado'
                }
                className="h-[46px] shrink-0"
              >
                {replying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Enviar'
                )}
              </Button>

            </div>
          </form>
        </div>
        </Modal>
      )}

      {selectedUser && (
        <Modal
          title={selectedUser.nome}
          subtitle={selectedUser.email}
          onClose={() => {
            setSelectedUser(null)
            setConfirmBan(false)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Tipo de conta</p>
              <p className="mt-1 font-medium text-[#0D1273]">
                {selectedUser.tipo === 'vendedor' ? 'Vendedor' : 'Comprador'}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Nível de acesso</p>
              <div className="mt-1"><AccessBadge level={selectedUser.nivel_acesso} /></div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Telefone</p>
              <p className="mt-1 font-medium text-[#0D1273]">{selectedUser.telefone || '—'}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Cadastro</p>
              <p className="mt-1 font-medium text-[#0D1273]">{formatDate(selectedUser.data_criacao)}</p>
            </div>
          </div>

          {selectedUser.localizacao && (
            <div className="mt-3 rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Localização</p>
              <p className="mt-1 text-sm text-gray-700">{selectedUser.localizacao}</p>
            </div>
          )}

          {selectedUser.banido_em ? (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Usuário banido</p>
              <p className="mt-1">Desde {formatDate(selectedUser.banido_em)}</p>
              {selectedUser.motivo_banimento && (
                <p className="mt-2">{selectedUser.motivo_banimento}</p>
              )}
            </div>
          ) : selectedUser.can_ban ? (
            <div className="mt-6 border-t border-gray-100 pt-5">
              {!confirmBan ? (
                <Button
                  variant="danger"
                  onClick={() => setConfirmBan(true)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Banir Usuário
                </Button>
              ) : (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-700">
                        Tem certeza?
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-red-600">
                        Essa ação é irreversível pelo painel. A conta será desativada, o login será bloqueado e todos os anúncios do vendedor serão desativados.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Motivo do banimento</Label>
                    <Textarea
                      className="mt-1.5"
                      rows={3}
                      maxLength={500}
                      value={banReason}
                      onChange={event => setBanReason(event.target.value)}
                      placeholder="Motivo administrativo..."
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmBan(false)}
                      disabled={banning}
                    >
                      Cancelar
                    </Button>

                    <Button
                      variant="danger"
                      onClick={banUser}
                      disabled={banning}
                    >
                      {banning ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Banindo...</>
                      ) : (
                        'Confirmar banimento'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              {Number(selectedUser.id) === Number(user?.id)
                ? 'Você não pode banir a própria conta.'
                : accessLevel === 'adm' && ['adm', 'ceo'].includes(selectedUser.nivel_acesso)
                  ? 'ADM não pode banir outro ADM ou o CEO.'
                  : 'Este usuário não pode ser banido por esta conta.'}
            </div>
          )}
        </Modal>
      )}

      {selectedClaim && (
        <Modal
          title={`Reivindicação #${selectedClaim.id}`}
          subtitle={`CPF ${formatCpf(selectedClaim.cpf)}`}
          onClose={() => setSelectedClaim(null)}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
              <span className="text-sm text-gray-500">Status</span>
              <Badge className={claimStatusClass(selectedClaim.status)}>
                {CLAIM_STATUS_LABELS[selectedClaim.status] || selectedClaim.status}
              </Badge>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">E-mail informado</p>
              <p className="mt-1 font-medium text-[#0D1273]">{selectedClaim.email}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Telefone informado</p>
              <p className="mt-1 font-medium text-[#0D1273]">{selectedClaim.telefone}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Motivo</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {selectedClaim.motivo}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Criada em</p>
              <p className="mt-1 text-sm text-gray-700">{formatDate(selectedClaim.data_criacao)}</p>
            </div>
          </div>

          {['aberta', 'em_analise'].includes(selectedClaim.status) ? (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="mb-3 text-sm text-gray-500">
                Ao aprovar, o e-mail e o telefone da conta antiga serão substituídos pelos dados informados nesta reivindicação.
              </p>

              <div className="mb-4">
                <Label>Motivo da rejeição (opcional)</Label>
                <Textarea
                  className="mt-1.5"
                  rows={3}
                  maxLength={1000}
                  value={rejectionReason}
                  onChange={event => setRejectionReason(event.target.value)}
                  placeholder="Preencha apenas se for rejeitar..."
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="danger"
                  onClick={rejectClaim}
                  disabled={decidingClaim}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rejeitar
                </Button>

                <Button
                  onClick={approveClaim}
                  disabled={decidingClaim}
                >
                  {decidingClaim ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 font-medium text-[#0D1273]">
                <Clock3 className="h-4 w-4" />
                Decisão registrada
              </div>

              <p className="mt-2">
                {selectedClaim.decisao_motivo || 'Sem observação adicional.'}
              </p>

              {selectedClaim.data_decisao && (
                <p className="mt-2 text-xs text-gray-400">
                  {formatDate(selectedClaim.data_decisao)}
                </p>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
