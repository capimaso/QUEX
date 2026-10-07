import React, {
  useEffect,
  useState,
} from 'react'
import {
  AlertTriangle,
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  Fish,
  MessageCircle,
  MessagesSquare,
  Package,
  Plus,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import {
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  listProducts,
  listSellerOrders,
  removeProduct,
  toggleProduct,
} from '@/api/data'
import {
  updateSellerOrderStatus,
} from '@/api/commerce'
import { listChats } from '@/api/module12'
import LoadingFish from '@/components/LoadingFish'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import OrderReviewAction from '@/components/OrderReviewAction'
import {
  Button,
  Input,
  Label,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

function ShippingConfirmModal({
  open,
  tracking,
  onTracking,
  onClose,
  onConfirm,
  saving,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-heading font-bold text-[#0D1273]">
          Marcar como Enviado
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          O código de rastreio é opcional.
        </p>

        <div className="mt-4">
          <Label>Código de Rastreio</Label>
          <Input
            className="mt-1.5"
            maxLength={100}
            value={tracking}
            onChange={event => onTracking(event.target.value)}
            placeholder="Ex.: QX-ABC123"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            onClick={onConfirm}
            disabled={saving}
          >
            <Truck className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Confirmar envio'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function OrderModal({
  order,
  user,
  onClose,
  onUpdated,
  onReviewed,
}) {
  const [tracking, setTracking] = useState(
    order?.my_delivery?.tracking_code || ''
  )
  const [saving, setSaving] = useState(false)
  const [shippingOpen, setShippingOpen] = useState(false)

  if (!order) return null

  const delivery = order.my_delivery || null
  const financial = order.seller_financial || {}
  const myItems = Array.isArray(order.items)
    ? order.items.filter(
        item => Number(item.seller_id) === Number(user?.id)
      )
    : []

  const sellerStatus =
    order.seller_status ||
    delivery?.status ||
    order.status ||
    'em_preparo'

  const update = async nextStatus => {
    setSaving(true)

    try {
      const updated = await updateSellerOrderStatus(
        order.id,
        nextStatus,
        nextStatus === 'enviado' ? tracking.trim() : ''
      )

      if (updated) {
        onUpdated(updated)
      }

      setShippingOpen(false)

      toast.success(
        nextStatus === 'entregue'
          ? 'Pedido marcado como Entregue. O saldo entrou em escrow por 24h.'
          : 'Status do pedido atualizado.'
      )
    } catch (error) {
      console.error(
        '[QUÉX] Falha ao atualizar pedido do vendedor:',
        error
      )

      toast.error(
        error.message ||
          'Não foi possível atualizar o pedido.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6"
        onMouseDown={event => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-xl font-heading font-bold text-[#0D1273]">
                Pedido #{order.id}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {order.buyer_name || 'Comprador'} ·{' '}
                {order.created_at
                  ? new Date(order.created_at).toLocaleString('pt-BR')
                  : 'Data indisponível'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-80px)] space-y-6 overflow-y-auto p-5">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[#0D1273]">
                  Itens da sua loja
                </h3>
                <OrderStatusBadge status={sellerStatus} />
              </div>

              {myItems.length > 0 ? (
                <div className="space-y-3">
                  {myItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-[#0D1273]">
                          {item.quantity}× {item.product_name}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {money(item.unit_price)} por {item.unit || 'un.'}
                        </p>
                      </div>
                      <strong>{money(item.subtotal)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
                  Os itens deste pedido não puderam ser carregados agora.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-gray-100 p-4">
              <h3 className="font-semibold text-[#0D1273]">
                Entrega
              </h3>

              {delivery?.type === 'retirada' ? (
                <p className="mt-2 text-sm text-gray-500">
                  Retirada em mãos.
                </p>
              ) : delivery ? (
                <>
                  <p className="mt-2 text-sm text-gray-500">
                    {delivery.address || 'Endereço não informado'}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Frete: {money(delivery.shipping_value)}
                    {delivery.distance_km != null
                      ? ` · ${Number(delivery.distance_km).toFixed(2)} km`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Os dados de entrega não estão disponíveis no momento.
                </p>
              )}

              {delivery?.tracking_code && (
                <p className="mt-2 text-sm text-gray-500">
                  Código de rastreio:{' '}
                  <strong>{delivery.tracking_code}</strong>
                </p>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">
                  Valor dos produtos
                </p>
                <p className="mt-1 font-bold text-[#0D1273]">
                  {money(financial.product_value)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs text-gray-400">
                  Taxa retida
                </p>
                <p className="mt-1 font-bold text-red-600">
                  - {money(financial.platform_fee)}
                </p>
              </div>

              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-xs text-green-700">
                  Líquido
                </p>
                <p className="mt-1 font-bold text-green-700">
                  {money(financial.net_value)}
                </p>
              </div>
            </section>

            {sellerStatus === 'em_preparo' &&
              delivery?.type === 'entrega' && (
                <Button
                  onClick={() => setShippingOpen(true)}
                  disabled={saving}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Marcar como Enviado
                </Button>
              )}

            {sellerStatus === 'em_preparo' &&
              delivery?.type === 'retirada' && (
                <Button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Confirmar que o pedido foi entregue ao comprador?'
                      )
                    ) {
                      update('entregue')
                    }
                  }}
                  disabled={saving}
                >
                  Marcar como Entregue
                </Button>
              )}

            {['enviado', 'despachado'].includes(sellerStatus) && (
              <Button
                onClick={() => {
                  if (
                    window.confirm(
                      'Confirmar que este pedido foi entregue?'
                    )
                  ) {
                    update('entregue')
                  }
                }}
                disabled={saving}
              >
                Marcar como Entregue
              </Button>
            )}

            {order.status === 'entregue' && (
              <OrderReviewAction
                order={order}
                onReviewed={onReviewed}
              />
            )}
          </div>
        </div>
      </div>

      <ShippingConfirmModal
        open={shippingOpen}
        tracking={tracking}
        onTracking={setTracking}
        onClose={() => setShippingOpen(false)}
        onConfirm={() => update('enviado')}
        saving={saving}
      />
    </>
  )
}

export default function SellerDashboardModule13() {
  const { user, capabilities } = useAuth()
  const location = useLocation()

  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [warnings, setWarnings] = useState([])
  const [tab, setTab] = useState('products')
  const [selectedOrder, setSelectedOrder] = useState(null)

  /*
    BUG 3 — causa raiz:
    a versão anterior chamava useMemo somente DEPOIS de retornos condicionais
    de loading/permissão. Isso alterava a quantidade/ordem de hooks entre renders
    e podia causar "Rendered more hooks than during the previous render".

    Aqui não existe mais hook condicional. O total líquido é derivado abaixo
    como cálculo normal, seguro mesmo com arrays vazios.
  */
  const netRevenue = orders
    .filter(order => order?.status !== 'cancelado')
    .reduce(
      (sum, order) =>
        sum + Number(order?.seller_financial?.net_value || 0),
      0
    )

  useEffect(() => {
    if (location.pathname === '/seller/products') {
      setTab('products')
    }
  }, [location.pathname])

  useEffect(() => {
    if (!capabilities?.canSell) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setWarnings([])

    const loadDashboard = async () => {
      const results = await Promise.allSettled([
        listProducts({ activeOnly: false }),
        listSellerOrders(),
        listChats(),
      ])

      if (!active) return

      const nextWarnings = []

      const productResult = results[0]
      if (productResult.status === 'fulfilled') {
        const rows = Array.isArray(productResult.value)
          ? productResult.value
          : []

        setProducts(
          rows.filter(
            product =>
              Number(product?.seller_id) === Number(user?.id)
          )
        )
      } else {
        console.error(
          '[QUÉX] Dashboard vendedor: falha ao carregar produtos:',
          productResult.reason
        )
        setProducts([])
        nextWarnings.push(
          'Não foi possível carregar seus anúncios agora.'
        )
      }

      const orderResult = results[1]
      if (orderResult.status === 'fulfilled') {
        setOrders(
          Array.isArray(orderResult.value)
            ? orderResult.value
            : []
        )
      } else {
        console.error(
          '[QUÉX] Dashboard vendedor: falha ao carregar pedidos:',
          orderResult.reason
        )
        setOrders([])
        nextWarnings.push(
          'Não foi possível carregar os pedidos recebidos agora.'
        )
      }

      const chatResult = results[2]
      if (chatResult.status === 'fulfilled') {
        setChats(
          Array.isArray(chatResult.value)
            ? chatResult.value
            : []
        )
      } else {
        console.error(
          '[QUÉX] Dashboard vendedor: falha ao carregar chats:',
          chatResult.reason
        )
        setChats([])
        nextWarnings.push(
          'As conversas não puderam ser carregadas agora.'
        )
      }

      setWarnings(nextWarnings)
      setLoading(false)
    }

    loadDashboard().catch(error => {
      console.error(
        '[QUÉX] Dashboard vendedor: erro inesperado ao carregar dados:',
        error
      )

      if (active) {
        setWarnings([
          'Alguns dados da loja não puderam ser carregados. Tente atualizar a página.',
        ])
        setLoading(false)
      }
    })

    return () => {
      active = false
    }
  }, [user?.id, capabilities?.canSell])

  if (!capabilities?.canSell) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <LoadingFish
        fullscreen
        size="lg"
        label="Carregando sua loja..."
      />
    )
  }

  const toggle = async product => {
    try {
      const updated = await toggleProduct(
        product.id,
        !product.active
      )

      setProducts(current =>
        current.map(item =>
          item.id === product.id ? updated : item
        )
      )
    } catch (error) {
      console.error(
        '[QUÉX] Dashboard vendedor: falha ao alterar anúncio:',
        error
      )
      toast.error(error.message)
    }
  }

  const remove = async product => {
    if (!window.confirm(`Excluir ${product.name}?`)) return

    try {
      await removeProduct(product.id)
      setProducts(current =>
        current.filter(item => item.id !== product.id)
      )
      toast.success('Produto excluído.')
    } catch (error) {
      console.error(
        '[QUÉX] Dashboard vendedor: falha ao remover anúncio:',
        error
      )
      toast.error(error.message)
    }
  }

  const replaceOrder = updated => {
    if (!updated?.id) return

    setOrders(current =>
      current.map(order =>
        order.id === updated.id ? updated : order
      )
    )
    setSelectedOrder(updated)
  }

  const markReviewed = (id, rating) => {
    setOrders(current =>
      current.map(order =>
        order.id === id
          ? {
              ...order,
              can_review: false,
              my_review: { rating },
            }
          : order
      )
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
              Minha Loja
            </h1>
            <p className="mt-1 text-gray-500">
              Gerencie anúncios, pedidos e conversas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/seller/products">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Ver Meus Anúncios
              </Button>
            </Link>

            <Link to="/seller/product/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Criar Novo Anúncio
              </Button>
            </Link>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Parte do painel está temporariamente indisponível.
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {warnings.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Produtos', value: products.length, icon: Fish },
            { label: 'Pedidos recebidos', value: orders.length, icon: Package },
            { label: 'Líquido a receber', value: money(netRevenue), icon: DollarSign },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0D1273]">
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0D1273]">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {chats.length > 0 && (
          <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <MessagesSquare className="h-5 w-5 text-[#0D1273]" />
              <h2 className="font-semibold text-[#0D1273]">
                Conversas dos pedidos
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {chats.slice(0, 6).map(chat => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0D1273]">
                      Pedido #{chat.pedido_id} · {chat.counterpart_name}
                    </p>
                  </div>

                  <Link to={`/chat/${chat.id}`}>
                    <Button size="sm" variant="outline">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Conversar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mb-6 inline-flex gap-1 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === 'products'
                ? 'bg-white font-medium text-[#0D1273] shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Produtos
          </button>

          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === 'orders'
                ? 'bg-white font-medium text-[#0D1273] shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Pedidos Recebidos
          </button>
        </div>

        {tab === 'products' ? (
          <div className="space-y-3">
            {products.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                Nenhum produto ainda.
              </div>
            ) : (
              products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <img
                    src={product.image_url}
                    alt=""
                    className="h-16 w-20 rounded-xl bg-gray-100 object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0D1273]">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {money(product.effective_price ?? product.price)} / {product.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link to={`/product/${product.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>

                    <Link to={`/seller/product/${product.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(product)}
                    >
                      {product.active ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(product)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                Nenhum pedido recebido.
              </div>
            ) : (
              orders.map(order => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full rounded-2xl border border-gray-100 bg-white p-5 text-left transition hover:border-[#5A5FBF]/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#0D1273]">
                        Pedido #{order.id}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {order.buyer_name || 'Comprador'} ·{' '}
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString('pt-BR')
                          : 'Data indisponível'}
                      </p>
                    </div>

                    <OrderStatusBadge
                      status={order.seller_status || order.status}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-400">Produtos</p>
                      <p className="mt-1 font-medium">
                        {money(order.seller_financial?.product_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Taxa retida</p>
                      <p className="mt-1 font-medium text-red-600">
                        {money(order.seller_financial?.platform_fee)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Líquido</p>
                      <p className="mt-1 font-bold text-green-700">
                        {money(order.seller_financial?.net_value)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                    <Store className="h-3.5 w-3.5" />
                    Clique para abrir os detalhes.
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <OrderModal
        order={selectedOrder}
        user={user}
        onClose={() => setSelectedOrder(null)}
        onUpdated={replaceOrder}
        onReviewed={markReviewed}
      />
    </>
  )
}
