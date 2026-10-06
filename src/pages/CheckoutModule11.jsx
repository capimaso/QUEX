import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  CreditCard,
  MapPin,
  PackageCheck,
  Store,
  Truck,
  WalletCards,
} from 'lucide-react'
import {
  Link,
  Navigate,
  useNavigate,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import { listCart } from '@/api/data'
import {
  calculateShipping,
  createCheckout,
  getCheckoutQuote,
} from '@/api/commerce'
import LoadingFish from '@/components/LoadingFish'
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

export default function CheckoutModule11() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [cart, setCart] = useState({
    items: [],
    cart: { total: 0 },
  })
  const [quote, setQuote] = useState(null)
  const [shippingRows, setShippingRows] = useState([])
  const [deliveryMethods, setDeliveryMethods] = useState({})
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [addressProblem, setAddressProblem] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'buyer') return

    let active = true
    setLoading(true)
    setAddressProblem('')

    Promise.all([
      listCart(),
      getCheckoutQuote(),
    ])
      .then(async ([cartData, quoteData]) => {
        if (!active) return

        setCart(cartData)
        setQuote(quoteData)

        const sellerIds = [
          ...new Set(
            (cartData.items || [])
              .map(item => Number(item.seller_id))
              .filter(Boolean)
          ),
        ]

        const initialMethods = Object.fromEntries(
          sellerIds.map(id => [id, 'retirada'])
        )

        setDeliveryMethods(initialMethods)

        if (!sellerIds.length) {
          setShippingRows([])
          return
        }

        try {
          const shipping = await calculateShipping(sellerIds)

          if (!active) return
          setShippingRows(shipping.fretes || [])
        } catch (error) {
          if (!active) return

          setShippingRows([])
          setAddressProblem(
            error.message ||
              'Não foi possível calcular as opções de entrega.'
          )
        }
      })
      .catch(error => {
        if (active) {
          toast.error(
            error.message ||
              'Não foi possível preparar o checkout.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.id, user?.role])

  const groups = useMemo(() => {
    const map = new Map()

    for (const item of cart.items || []) {
      const sellerId = Number(item.seller_id)

      if (!map.has(sellerId)) {
        map.set(sellerId, {
          seller_id: sellerId,
          seller_name: item.seller_name || 'Vendedor',
          items: [],
        })
      }

      map.get(sellerId).items.push(item)
    }

    return [...map.values()]
  }, [cart.items])

  const shippingMap = useMemo(
    () =>
      new Map(
        shippingRows.map(row => [
          Number(row.vendedor_id),
          row,
        ])
      ),
    [shippingRows]
  )

  const productsSubtotal =
    quote?.subtotal_produtos ??
    (cart.items || []).reduce(
      (sum, item) => sum + Number(item.subtotal || 0),
      0
    )

  const shippingTotal = useMemo(
    () =>
      groups.reduce((sum, group) => {
        if (deliveryMethods[group.seller_id] !== 'entrega') {
          return sum
        }

        const freight = shippingMap.get(group.seller_id)
        return sum + Number(freight?.valor_frete || 0)
      }, 0),
    [groups, deliveryMethods, shippingMap]
  )

  const grandTotal =
    Number(productsSubtotal || 0) + Number(shippingTotal || 0)

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
        label="Preparando o checkout..."
      />
    )
  }

  if (!(cart.items || []).length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <PackageCheck className="mx-auto mb-4 h-14 w-14 text-gray-300" />
        <h1 className="text-2xl font-heading font-bold text-[#0D1273]">
          Seu carrinho está vazio
        </h1>
        <Link
          to="/marketplace"
          className="mt-4 inline-block font-medium text-[#0D1273] hover:underline"
        >
          Voltar ao marketplace
        </Link>
      </div>
    )
  }

  const chooseDelivery = (sellerId, type) => {
    setDeliveryMethods(current => ({
      ...current,
      [sellerId]: type,
    }))
  }

  const finish = async () => {
    if (addressProblem) {
      return toast.error(
        'Atualize seu endereço antes de finalizar a compra.'
      )
    }

    for (const group of groups) {
      if (!deliveryMethods[group.seller_id]) {
        return toast.error(
          'Escolha uma opção de entrega para cada vendedor.'
        )
      }

      if (deliveryMethods[group.seller_id] === 'entrega') {
        const freight = shippingMap.get(group.seller_id)

        if (freight?.valor_frete == null) {
          return toast.error(
            `A entrega de ${group.seller_name} não está disponível agora.`
          )
        }
      }
    }

    setFinishing(true)

    try {
      const result = await createCheckout({
        items: cart.items,
        deliveryMethods: groups.map(group => ({
          vendedor_id: group.seller_id,
          tipo_frete: deliveryMethods[group.seller_id],
        })),
        paymentMethod,
      })

      const orderId = Number(result.order?.id)

      if (!orderId) {
        throw new Error(
          'O pedido foi criado sem um identificador válido.'
        )
      }

      toast.success('Pedido criado! Agora falta confirmar o pagamento.')
      navigate(`/orders/${orderId}`, {
        replace: true,
      })
    } catch (error) {
      toast.error(
        error.message ||
          'Não foi possível finalizar a compra.'
      )
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Checkout
        </h1>

        <p className="mt-1 text-gray-500">
          Escolha retirada ou entrega separadamente para cada vendedor.
        </p>
      </div>

      {addressProblem && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                Seu endereço precisa ser atualizado
              </p>
              <p className="mt-1">{addressProblem}</p>
              <Link
                to="/profile"
                className="mt-2 inline-block font-semibold underline"
              >
                Abrir Meu Perfil
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {groups.map(group => {
            const freight = shippingMap.get(group.seller_id)
            const deliveryReady =
              freight?.entrega_disponivel &&
              freight?.valor_frete != null

            return (
              <section
                key={group.seller_id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              >
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]">
                    <Store className="h-4 w-4" />
                  </div>

                  <div>
                    <h2 className="font-semibold text-[#0D1273]">
                      {group.seller_name}
                    </h2>
                    <p className="text-xs text-gray-400">
                      Pedido deste vendedor
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-3">
                    {group.items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3"
                      >
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="h-14 w-14 rounded-xl bg-gray-100 object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#0D1273]">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.quantity} × {money(item.product_price)}
                          </p>
                        </div>

                        <strong className="text-sm">
                          {money(item.subtotal)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <p className="mb-3 text-sm font-semibold text-[#0D1273]">
                      Como você quer receber?
                    </p>

                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
                        <input
                          type="radio"
                          name={`shipping-${group.seller_id}`}
                          value="retirada"
                          checked={
                            deliveryMethods[group.seller_id] === 'retirada'
                          }
                          onChange={() =>
                            chooseDelivery(group.seller_id, 'retirada')
                          }
                          className="mt-1 accent-[#0D1273]"
                        />

                        <div>
                          <p className="text-sm font-medium">
                            Retirada em mãos
                          </p>
                          <p className="text-xs text-gray-400">
                            Grátis
                          </p>
                        </div>
                      </label>

                      {deliveryReady && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
                          <input
                            type="radio"
                            name={`shipping-${group.seller_id}`}
                            value="entrega"
                            checked={
                              deliveryMethods[group.seller_id] === 'entrega'
                            }
                            onChange={() =>
                              chooseDelivery(group.seller_id, 'entrega')
                            }
                            className="mt-1 accent-[#0D1273]"
                          />

                          <Truck className="mt-0.5 h-4 w-4 text-[#0D1273]" />

                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                Entrega pelo vendedor
                              </p>
                              <strong className="text-sm text-[#0D1273]">
                                {money(freight.valor_frete)}
                              </strong>
                            </div>

                            <p className="mt-1 text-xs text-gray-400">
                              Rota mais rápida: {Number(freight.distancia_km).toFixed(2)} km
                            </p>
                          </div>
                        </label>
                      )}

                      {!deliveryReady && freight?.aviso && (
                        <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                          {freight.aviso}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )
          })}

          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#0D1273]" />
              <h2 className="font-semibold text-[#0D1273]">
                Pagamento
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                <input
                  type="radio"
                  name="payment"
                  value="pix"
                  checked={paymentMethod === 'pix'}
                  onChange={() => setPaymentMethod('pix')}
                  className="accent-[#0D1273]"
                />
                <WalletCards className="h-4 w-4" />
                <span className="text-sm font-medium">Pix</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                <input
                  type="radio"
                  name="payment"
                  value="cartao"
                  checked={paymentMethod === 'cartao'}
                  onChange={() => setPaymentMethod('cartao')}
                  className="accent-[#0D1273]"
                />
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Cartão de Crédito
                </span>
              </label>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              O Módulo 11 usa um pagamento simulado. Nenhum cartão real será cobrado.
            </p>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold text-[#0D1273]">
            Resumo
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">
                Produtos
              </span>
              <span>{money(productsSubtotal)}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-gray-500">
                Frete
              </span>
              <span>{money(shippingTotal)}</span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-gray-500">
                Taxa de serviço
              </span>
              <span>{money(quote?.taxa_servico)}</span>
            </div>

            <div className="rounded-xl bg-[#5A5FBF]/5 p-3 text-xs text-gray-500">
              A taxa de serviço é retida do vendedor. Ela <strong>não é somada</strong> ao valor pago por você.
            </div>
          </div>

          <div className="my-5 border-t border-gray-100" />

          <div className="flex items-end justify-between gap-3">
            <span className="font-semibold text-[#0D1273]">
              Total a pagar
            </span>
            <span className="text-2xl font-bold text-[#0D1273]">
              {money(grandTotal)}
            </span>
          </div>

          <Badge className="mt-3 bg-[#0D1273]/5 text-[#0D1273]">
            {quote?.taxa_percentual ?? 0}% de taxa da plataforma
          </Badge>

          <Button
            className="mt-5 w-full"
            disabled={finishing || Boolean(addressProblem)}
            onClick={finish}
          >
            {finishing ? 'Finalizando...' : 'Finalizar Compra'}
          </Button>
        </aside>
      </div>
    </div>
  )
}
