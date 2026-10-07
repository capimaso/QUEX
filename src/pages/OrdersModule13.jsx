import React, { useEffect, useState } from 'react'
import {
  CreditCard,
  Package,
  Star,
} from 'lucide-react'
import {
  Link,
  Navigate,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import { listBuyerOrders } from '@/api/data'
import LoadingFish from '@/components/LoadingFish'
import OrderReviewAction from '@/components/OrderReviewAction'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { Button } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function OrdersModule13() {
  const { user, capabilities } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!capabilities?.canBuy) return

    let active = true

    listBuyerOrders()
      .then(rows => {
        if (active) setOrders(rows)
      })
      .catch(error =>
        toast.error(
          error.message ||
            'Não foi possível carregar seus pedidos.'
        )
      )
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.id, capabilities?.canBuy])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!capabilities?.canBuy) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <LoadingFish
        fullscreen
        size="lg"
        label="Carregando pedidos..."
      />
    )
  }

  const markReviewed = (id, rating) => {
    setOrders(list =>
      list.map(order =>
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

  const pendingReviews = orders.filter(
    order => order.can_review
  ).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Meus Pedidos
        </h1>
        <p className="mt-1 text-gray-500">
          Acompanhe pagamentos, entregas e avaliações.
        </p>
      </div>

      {pendingReviews > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Star className="h-5 w-5 shrink-0 fill-amber-400 text-amber-500" />
          {pendingReviews === 1
            ? 'Você tem 1 pedido entregue esperando sua avaliação.'
            : `Você tem ${pendingReviews} pedidos entregues esperando sua avaliação.`}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-16 text-center text-gray-400">
          <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Nenhum pedido ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <article
              key={order.id}
              className="rounded-2xl border border-gray-100 bg-white p-5"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <Link
                    to={`/orders/${order.id}`}
                    className="font-semibold text-[#0D1273] hover:underline"
                  >
                    Pedido #{order.id}
                  </Link>

                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleString('pt-BR')}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    Vendedores:{' '}
                    {(order.sellers || [])
                      .map(seller => seller.name)
                      .join(', ') || '—'}
                  </p>
                </div>

                <OrderStatusBadge status={order.status} />
              </div>

              <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-400">Produtos</p>
                  <p className="mt-1 font-medium">
                    {money(order.subtotal_products)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Frete</p>
                  <p className="mt-1 font-medium">
                    {money(order.shipping_total)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="mt-1 font-bold text-[#0D1273]">
                    {money(order.total)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {order.status === 'aguardando_pagamento' && (
                  <Link to={`/orders/${order.id}`}>
                    <Button size="sm">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pagar Agora
                    </Button>
                  </Link>
                )}

                <Link to={`/orders/${order.id}`}>
                  <Button
                    size="sm"
                    variant="outline"
                  >
                    Ver detalhes
                  </Button>
                </Link>

                {order.status === 'entregue' && (
                  <OrderReviewAction
                    order={order}
                    onReviewed={markReviewed}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
