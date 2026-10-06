import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DollarSign,
  Edit,
  Eye,
  EyeOff,
  Fish,
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
import LoadingFish from '@/components/LoadingFish'
import OrderReviewAction from '@/components/OrderReviewAction'
import {
  Badge,
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

const statusLabel = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_preparo: 'Em preparo',
  enviado: 'Enviado',
  despachado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
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

  if (!order) return null

  const delivery = order.my_delivery
  const financial = order.seller_financial
  const myItems = (order.items || []).filter(
    item => Number(item.seller_id) === Number(user.id)
  )

  const update = async nextStatus => {
    setSaving(true)

    try {
      const updated = await updateSellerOrderStatus(
        order.id,
        nextStatus,
        nextStatus === 'enviado' ? tracking.trim() : ''
      )

      onUpdated(updated)
      toast.success(
        `Pedido atualizado para ${statusLabel[nextStatus] || nextStatus}.`
      )
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível atualizar o pedido.'
      )
    } finally {
      setSaving(false)
    }
  }

  const sellerStatus =
    order.seller_status ||
    delivery?.status ||
    order.status

  return (
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
              {order.buyer_name} ·{' '}
              {new Date(order.created_at).toLocaleString('pt-BR')}
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
              <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
                {statusLabel[sellerStatus] || sellerStatus}
              </Badge>
            </div>

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
                      {money(item.unit_price)} por {item.unit}
                    </p>
                  </div>

                  <strong>{money(item.subtotal)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-[#0D1273]">
              Entrega
            </h3>

            {delivery?.type === 'retirada' ? (
              <p className="mt-2 text-sm text-gray-500">
                Retirada em mãos.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-500">
                  {delivery?.address || 'Endereço não informado'}
                </p>

                <p className="mt-2 text-xs text-gray-400">
                  Frete: {money(delivery?.shipping_value)}
                  {delivery?.distance_km != null
                    ? ` · ${Number(delivery.distance_km).toFixed(2)} km`
                    : ''}
                </p>
              </>
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
                {money(financial?.product_value)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">
                Taxa retida
              </p>
              <p className="mt-1 font-bold text-red-600">
                - {money(financial?.platform_fee)}
              </p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-700">
                Líquido a receber
              </p>
              <p className="mt-1 font-bold text-green-700">
                {money(financial?.net_value)}
              </p>
            </div>
          </section>

          {sellerStatus === 'aguardando_pagamento' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Aguarde o comprador confirmar o pagamento antes de preparar o pedido.
            </div>
          )}

          {sellerStatus === 'pago' && (
            <Button
              onClick={() => update('em_preparo')}
              disabled={saving}
            >
              <Package className="mr-2 h-4 w-4" />
              Marcar como Em Preparo
            </Button>
          )}

          {sellerStatus === 'em_preparo' &&
            delivery?.type === 'entrega' && (
              <div className="space-y-3">
                <div>
                  <Label>
                    Código de rastreio{' '}
                    <span className="font-normal text-gray-400">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    className="mt-1.5"
                    maxLength={100}
                    value={tracking}
                    onChange={event =>
                      setTracking(event.target.value)
                    }
                    placeholder="Ex.: QX-ABC123"
                  />
                </div>

                <Button
                  onClick={() => update('enviado')}
                  disabled={saving}
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Marcar como Enviado
                </Button>
              </div>
            )}

          {sellerStatus === 'em_preparo' &&
            delivery?.type === 'retirada' && (
              <Button
                onClick={() => update('entregue')}
                disabled={saving}
              >
                Marcar como Entregue
              </Button>
            )}

          {['enviado', 'despachado'].includes(sellerStatus) && (
            <Button
              onClick={() => update('entregue')}
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
  )
}

export default function SellerDashboardModule11() {
  const { user } = useAuth()

  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('products')
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    if (user?.role !== 'seller') return

    let active = true

    Promise.all([
      listProducts({ activeOnly: false }),
      listSellerOrders(),
    ])
      .then(([productRows, orderRows]) => {
        if (!active) return

        setProducts(
          productRows.filter(
            product => Number(product.seller_id) === Number(user.id)
          )
        )
        setOrders(orderRows)
      })
      .catch(error =>
        toast.error(
          error.message ||
            'Não foi possível carregar sua loja.'
        )
      )
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.id, user?.role])

  if (user?.role !== 'seller') {
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

  const netRevenue = useMemo(
    () =>
      orders
        .filter(order => order.status !== 'cancelado')
        .reduce(
          (sum, order) =>
            sum + Number(order.seller_financial?.net_value || 0),
          0
        ),
    [orders]
  )

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

      toast.success(
        updated.active
          ? 'Produto ativado.'
          : 'Produto desativado.'
      )
    } catch (error) {
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
      toast.error(error.message)
    }
  }

  const replaceOrder = updated => {
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

    setSelectedOrder(current =>
      current?.id === id
        ? {
            ...current,
            can_review: false,
            my_review: { rating },
          }
        : current
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
              Minha Loja
            </h1>
            <p className="mt-1 text-gray-500">
              Gerencie produtos, pedidos e valores líquidos.
            </p>
          </div>

          <Link to="/seller/product/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Produtos',
              value: products.length,
              icon: Fish,
            },
            {
              label: 'Pedidos recebidos',
              value: orders.length,
              icon: Package,
            },
            {
              label: 'Líquido a receber',
              value: money(netRevenue),
              icon: DollarSign,
            },
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
                <Fish className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p>Nenhum produto ainda.</p>
              </div>
            ) : (
              products.map(product => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                >
                  <img
                    src={product.image_url}
                    className="h-16 w-20 rounded-xl bg-gray-100 object-cover"
                    alt=""
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0D1273]">
                      {product.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {product.species} · {money(product.effective_price ?? product.price)} / {product.unit}
                    </p>

                    <Badge
                      className={
                        product.active
                          ? 'mt-2 bg-green-100 text-green-700'
                          : 'mt-2 bg-gray-100 text-gray-500'
                      }
                    >
                      {product.active ? 'Ativo' : 'Desativado'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link to={`/product/${product.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>

                    <Link to={`/seller/product/${product.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(product)}
                      title={product.active ? 'Desativar' : 'Ativar'}
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
                      title="Excluir"
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
                <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p>Nenhum pedido para seus produtos.</p>
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
                        {order.buyer_name} ·{' '}
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
                      {order.seller_status_label}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        Produtos
                      </p>
                      <p className="mt-1 font-medium">
                        {money(order.seller_financial?.product_value)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Taxa retida
                      </p>
                      <p className="mt-1 font-medium text-red-600">
                        {money(order.seller_financial?.platform_fee)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400">
                        Líquido
                      </p>
                      <p className="mt-1 font-bold text-green-700">
                        {money(order.seller_financial?.net_value)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                    <Store className="h-3.5 w-3.5" />
                    Clique para abrir os detalhes do pedido.
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
