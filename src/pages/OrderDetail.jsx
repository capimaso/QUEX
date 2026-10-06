import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  Store,
  Truck,
} from 'lucide-react'
import {
  Link,
  Navigate,
  useParams,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  confirmMockPayment,
  getOrder,
} from '@/api/commerce'
import LoadingFish from '@/components/LoadingFish'
import OrderReviewAction from '@/components/OrderReviewAction'
import {
  Badge,
  Button,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const money = value =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

export default function OrderDetail() {
  const { id } = useParams()
  const { user } = useAuth()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  const load = async () => {
    const data = await getOrder(id)
    setOrder(data)
    return data
  }

  useEffect(() => {
    if (user?.role !== 'buyer') return

    let active = true
    setLoading(true)

    getOrder(id)
      .then(data => {
        if (active) setOrder(data)
      })
      .catch(error =>
        toast.error(
          error.message ||
            'Não foi possível abrir o pedido.'
        )
      )
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, user?.role])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'buyer') {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <LoadingFish
        fullscreen
        size="lg"
        label="Carregando pedido..."
      />
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        Pedido não encontrado.
      </div>
    )
  }

  const confirmPayment = async () => {
    if (!order.payment?.gateway_id) {
      return toast.error(
        'O pedido não possui um pagamento mock válido.'
      )
    }

    setPaying(true)

    try {
      await confirmMockPayment({
        orderId: order.id,
        gatewayId: order.payment.gateway_id,
      })

      await load()
      toast.success(
        'Pagamento simulado aprovado! O pedido está em preparo.'
      )
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível aprovar o pagamento.'
      )
    } finally {
      setPaying(false)
    }
  }

  const markReviewed = (_id, rating) => {
    setOrder(current => ({
      ...current,
      can_review: false,
      my_review: { rating },
    }))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/orders"
        className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-[#0D1273]"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Voltar aos pedidos
      </Link>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[#0D1273]">
            Pedido #{order.id}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {new Date(order.created_at).toLocaleString('pt-BR')}
          </p>
        </div>

        <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
          <Clock className="mr-1 h-3 w-3" />
          {order.status_label}
        </Badge>
      </div>

      {order.status === 'aguardando_pagamento' && (
        <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <h2 className="font-semibold text-orange-900">
                Pagamento simulado pendente
              </h2>
              <p className="mt-1 text-sm text-orange-800">
                Método escolhido:{' '}
                <strong>
                  {order.payment?.method === 'cartao'
                    ? 'Cartão de Crédito'
                    : 'Pix'}
                </strong>
                . Nenhum valor real será cobrado.
              </p>

              <Button
                className="mt-4"
                onClick={confirmPayment}
                disabled={paying}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {paying
                  ? 'Aprovando...'
                  : 'Simular Pagamento Aprovado'}
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-[#0D1273]" />
              <h2 className="font-semibold text-[#0D1273]">
                Itens
              </h2>
            </div>

            <div className="space-y-4">
              {(order.items || []).map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="h-14 w-14 rounded-xl bg-gray-100 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-gray-100" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#0D1273]">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.seller_name} · {item.quantity} ×{' '}
                      {money(item.unit_price)}
                    </p>
                  </div>

                  <strong className="text-sm">
                    {money(item.subtotal)}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#0D1273]" />
              <h2 className="font-semibold text-[#0D1273]">
                Entregas e retiradas
              </h2>
            </div>

            <div className="space-y-4">
              {(order.deliveries || []).map(delivery => (
                <div
                  key={delivery.id}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-medium text-[#0D1273]">
                      <Store className="h-4 w-4" />
                      {delivery.seller_name}
                    </p>

                    <Badge className="bg-gray-100 text-gray-600">
                      {delivery.type === 'retirada'
                        ? 'Retirada'
                        : 'Entrega'}
                    </Badge>
                  </div>

                  {delivery.type === 'retirada' ? (
                    <p className="mt-3 text-sm text-gray-500">
                      Retirada em mãos — sem frete.
                    </p>
                  ) : (
                    <>
                      <p className="mt-3 flex gap-2 text-sm text-gray-500">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        {delivery.address}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        Frete: {money(delivery.shipping_value)}
                        {delivery.distance_km != null
                          ? ` · ${Number(delivery.distance_km).toFixed(2)} km`
                          : ''}
                      </p>
                    </>
                  )}

                  {delivery.tracking_code && (
                    <p className="mt-2 text-sm text-gray-500">
                      Código de rastreio:{' '}
                      <strong>{delivery.tracking_code}</strong>
                    </p>
                  )}

                  <p className="mt-2 text-xs text-gray-400">
                    Status: {delivery.status}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="font-semibold text-[#0D1273]">
            Resumo
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">
                Produtos
              </span>
              <span>{money(order.subtotal_products)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Frete
              </span>
              <span>{money(order.shipping_total)}</span>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-[#0D1273]">
                  Total
                </span>
                <strong className="text-lg text-[#0D1273]">
                  {money(order.total)}
                </strong>
              </div>
            </div>
          </div>

          {order.payment && (
            <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
              Pagamento: <strong>{order.payment.status}</strong>
              <br />
              Método:{' '}
              {order.payment.method === 'cartao'
                ? 'Cartão de Crédito'
                : 'Pix'}
            </div>
          )}

          {order.status === 'entregue' && (
            <div className="mt-5">
              <OrderReviewAction
                order={order}
                onReviewed={markReviewed}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
