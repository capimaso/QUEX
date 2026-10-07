import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Ban,
  Eye,
  EyeOff,
  Package,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  banAdminUser,
  listAdminUsers,
} from '@/api/admin'
import {
  deleteAdminUser,
  getAdminOrder,
  listAdminOrders,
  listAdminProducts,
  reactivateAdminProduct,
  retainAdminProduct,
} from '@/api/module13'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import TripleConfirmModal from '@/components/TripleConfirmModal'
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

function Modal({
  title,
  onClose,
  children,
  wide = false,
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4 py-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`max-h-[90vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-heading text-xl font-bold text-[#0D1273]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-70px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function FinalAdjustmentsPanel() {
  const { user } = useAuth()

  const [tab, setTab] = useState('products')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [productFilter, setProductFilter] = useState('all')
  const [productSearch, setProductSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const [retainTarget, setRetainTarget] = useState(null)
  const [retentionReason, setRetentionReason] = useState('')
  const [retaining, setRetaining] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [orderDetail, setOrderDetail] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)

  const level = String(
    user?.access_level || 'comum'
  ).toLowerCase()

  const loadAll = async silent => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const [productRows, userRows, orderRows] =
        await Promise.all([
          listAdminProducts(),
          listAdminUsers(),
          listAdminOrders(),
        ])

      setProducts(productRows)
      setUsers(userRows)
      setOrders(orderRows)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível carregar os ajustes administrativos.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!['adm', 'ceo'].includes(level)) return
    loadAll(false)
  }, [level])

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()

    return products.filter(product => {
      const statusOk =
        productFilter === 'all' ||
        (productFilter === 'active' &&
          product.active &&
          !product.retained) ||
        (productFilter === 'retained' && product.retained)

      if (!statusOk) return false
      if (!search) return true

      return [
        product.name,
        product.seller_name,
        String(product.id),
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(search)
      )
    })
  }, [products, productFilter, productSearch])

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()

    if (!search) return users

    return users.filter(item =>
      [
        item.nome,
        item.email,
        item.tipo,
        item.nivel_acesso,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(search)
      )
    )
  }, [users, userSearch])

  const confirmRetention = async () => {
    if (!retainTarget) return

    const reason = retentionReason.trim()

    if (reason.length < 5) {
      return toast.error(
        'Informe um motivo de retenção com pelo menos 5 caracteres.'
      )
    }

    setRetaining(true)

    try {
      await retainAdminProduct(retainTarget.id, reason)
      toast.success(
        'Anúncio retido. O vendedor foi notificado.'
      )
      setRetainTarget(null)
      setRetentionReason('')
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível reter o anúncio.'
      )
    } finally {
      setRetaining(false)
    }
  }

  const reactivate = async product => {
    try {
      await reactivateAdminProduct(product.id)
      toast.success('Anúncio reativado.')
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível reativar o anúncio.'
      )
    }
  }

  const quickBan = async target => {
    const reason = window.prompt(
      `Motivo do banimento de ${target.nome}:`,
      'Banimento administrativo'
    )

    if (reason === null) return

    try {
      await banAdminUser(
        target.id,
        reason.trim() || 'Banimento administrativo'
      )
      toast.success('Usuário banido.')
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível banir o usuário.'
      )
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      await deleteAdminUser(deleteTarget.id)
      toast.success(
        'Perfil excluído e dados pessoais anonimizados.'
      )
      setDeleteTarget(null)
      await loadAll(true)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível excluir o perfil.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const openOrder = async order => {
    setOrderLoading(true)

    try {
      const detail = await getAdminOrder(order.id)
      setOrderDetail(detail)
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível abrir o pedido.'
      )
    } finally {
      setOrderLoading(false)
    }
  }

  const canDeleteUser = target => {
    if (Number(target.id) === Number(user?.id)) return false

    const targetLevel = String(
      target.nivel_acesso || 'comum'
    ).toLowerCase()

    if (level === 'adm' && ['adm', 'ceo'].includes(targetLevel)) {
      return false
    }

    if (level === 'ceo' && targetLevel === 'ceo') {
      return false
    }

    return true
  }

  if (!['adm', 'ceo'].includes(level)) return null

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="font-heading text-xl font-bold text-[#0D1273]">
                Ajustes Finais
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Gerencie anúncios, exclusões e status dos pedidos.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAll(true)}
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

          <div className="mb-5 flex flex-wrap gap-2">
            {[
              ['products', 'Gerenciar Anúncios'],
              ['users', 'Gerenciar Usuários'],
              ['orders', 'Pedidos'],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  tab === id
                    ? 'bg-[#0D1273] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">
              Carregando...
            </div>
          ) : tab === 'products' ? (
            <div>
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={productSearch}
                    onChange={event =>
                      setProductSearch(event.target.value)
                    }
                    placeholder="Buscar anúncio ou vendedor..."
                  />
                </div>

                <Select
                  value={productFilter}
                  onChange={event =>
                    setProductFilter(event.target.value)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="retained">Retidos</option>
                </Select>
              </div>

              <div className="space-y-3">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 p-4 md:flex-row md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#0D1273]">
                          #{product.id} · {product.name}
                        </p>

                        {product.retained ? (
                          <Badge className="bg-red-100 text-red-700">
                            Retido
                          </Badge>
                        ) : product.active ? (
                          <Badge className="bg-green-100 text-green-700">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">
                            Inativo
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {product.seller_name} · {money(product.price)}
                      </p>

                      {product.retention_reason && (
                        <p className="mt-2 text-xs text-red-600">
                          Motivo: {product.retention_reason}
                        </p>
                      )}
                    </div>

                    {product.retained ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reactivate(product)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Reativar Anúncio
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRetainTarget(product)
                          setRetentionReason('')
                        }}
                      >
                        <EyeOff className="mr-2 h-4 w-4" />
                        Reter Anúncio
                      </Button>
                    )}
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="py-10 text-center text-sm text-gray-400">
                    Nenhum anúncio encontrado.
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'users' ? (
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  value={userSearch}
                  onChange={event =>
                    setUserSearch(event.target.value)
                  }
                  placeholder="Buscar usuário..."
                />
              </div>

              <div className="space-y-3">
                {filteredUsers.map(target => (
                  <div
                    key={target.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-semibold text-[#0D1273]">
                        {target.nome}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {target.email} · {target.nivel_acesso}
                      </p>

                      {target.banido_em && (
                        <Badge className="mt-2 bg-red-100 text-red-700">
                          Banido
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!target.banido_em && target.can_ban && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => quickBan(target)}
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Banir
                        </Button>
                      )}

                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!canDeleteUser(target)}
                        title={
                          canDeleteUser(target)
                            ? 'Excluir perfil'
                            : 'Você não tem permissão para excluir este perfil.'
                        }
                        onClick={() => setDeleteTarget(target)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Perfil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => openOrder(order)}
                  className="flex w-full flex-col justify-between gap-4 rounded-xl border border-gray-100 p-4 text-left transition hover:border-[#5A5FBF]/40 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-semibold text-[#0D1273]">
                      Pedido #{order.id}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {order.buyer_name} · {money(order.total)}
                    </p>
                  </div>

                  <OrderStatusBadge status={order.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {retainTarget && (
        <Modal
          title={`Reter anúncio #${retainTarget.id}`}
          onClose={() => setRetainTarget(null)}
        >
          <p className="mb-4 text-sm text-gray-500">
            O anúncio sairá imediatamente do Marketplace e o vendedor receberá uma notificação.
          </p>

          <Label>Motivo da retenção</Label>
          <Textarea
            className="mt-1.5"
            rows={5}
            maxLength={1000}
            value={retentionReason}
            onChange={event =>
              setRetentionReason(event.target.value)
            }
            placeholder="Explique claramente por que o anúncio foi retido..."
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRetainTarget(null)}
            >
              Cancelar
            </Button>

            <Button
              variant="danger"
              onClick={confirmRetention}
              disabled={retaining}
            >
              {retaining ? 'Retendo...' : 'Confirmar Retenção'}
            </Button>
          </div>
        </Modal>
      )}

      <TripleConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Excluir Perfil"
        subject={
          deleteTarget
            ? `o perfil de ${deleteTarget.nome}`
            : 'este perfil'
        }
      />

      {orderDetail && (
        <Modal
          title={`Pedido #${orderDetail.id}`}
          onClose={() => setOrderDetail(null)}
          wide
        >
          <div className="mb-4 flex justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">
                Comprador #{orderDetail.buyer_id}
              </p>
              <p className="mt-1 font-bold text-[#0D1273]">
                Total: {money(orderDetail.total)}
              </p>
            </div>

            <OrderStatusBadge status={orderDetail.status} />
          </div>

          <div className="space-y-3">
            {(orderDetail.deliveries || []).map(delivery => (
              <div
                key={delivery.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    Vendedor #{delivery.vendedor_id}
                  </p>
                  <p className="text-xs text-gray-400">
                    {delivery.tipo_frete || 'entrega'}
                  </p>
                </div>

                <OrderStatusBadge status={delivery.status} />
              </div>
            ))}
          </div>
        </Modal>
      )}

      {orderLoading && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/20 text-white">
          Carregando pedido...
        </div>
      )}
    </>
  )
}
