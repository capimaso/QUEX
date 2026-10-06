import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router-dom'
import {
  ArrowRight,
  Fish,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  listCart,
  removeCartItem,
  updateCartItem,
} from '@/api/data'
import LoadingFish from '@/components/LoadingFish'
import { Button } from '@/components/ui'

export default function Cart() {
  const [data, setData] =
    useState({
      items: [],
      cart: { total: 0 },
    })

  const [loading, setLoading] =
    useState(true)

  const navigate =
    useNavigate()

  const load = () =>
    listCart()
      .then(setData)
      .catch(error =>
        toast.error(
          error.message
        )
      )
      .finally(() =>
        setLoading(false)
      )

  useEffect(load, [])

  const items =
    data.items || []

  const total =
    useMemo(
      () =>
        items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.subtotal || 0
            ),
          0
        ),
      [items]
    )

  const update = async (
    item,
    delta
  ) => {
    try {
      const result =
        await updateCartItem(
          item.id,
          item.quantity +
            delta
        )

      setData(result)
    } catch (error) {
      toast.error(
        error.message
      )
    }
  }

  const remove =
    async item => {
      try {
        const result =
          await removeCartItem(
            item.id
          )

        setData(result)
        toast.success(
          'Item removido.'
        )
      } catch (error) {
        toast.error(
          error.message
        )
      }
    }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <LoadingFish
          size="lg"
          label="Carregando carrinho..."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Seu Carrinho
        </h1>

        <p className="mt-1 text-gray-500">
          Revise seus produtos antes de finalizar o pedido
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-16 text-center">
          <ShoppingCart className="mx-auto mb-4 h-14 w-14 text-gray-300" />

          <p className="text-lg font-medium text-gray-600">
            Seu carrinho está vazio
          </p>

          <Link
            to="/marketplace"
            className="mt-4 inline-flex items-center font-medium text-[#0D1273] hover:underline"
          >
            Ver marketplace
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-4"
              >
                <Link
                  to={`/product/${item.product_id}`}
                  className="shrink-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5FBF]"
                  aria-label={`Abrir anúncio de ${item.product_name}`}
                >
                  <img
                    src={
                      item.product_image
                    }
                    alt={
                      item.product_name
                    }
                    className="h-20 w-20 rounded-xl bg-gray-100 object-cover transition hover:opacity-90"
                    onError={event => {
                      event.currentTarget.style.display =
                        'none'
                    }}
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${item.product_id}`}
                    className="font-semibold text-[#0D1273] hover:underline"
                  >
                    <h3 className="truncate">
                      {item.product_name}
                    </h3>
                  </Link>

                  <p className="mt-1 text-xs text-gray-400">
                    {item.seller_name}
                  </p>

                  {item.promotion_active && (
                    <p className="mt-2 text-xs text-gray-400 line-through">
                      R$ {Number(item.original_price).toFixed(2)}
                    </p>
                  )}

                  <p
                    className={`${
                      item.promotion_active
                        ? 'text-[#F2541B]'
                        : ''
                    } text-sm font-medium`}
                  >
                    R$ {Number(item.product_price).toFixed(2)} / unidade
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Subtotal: R$ {Number(item.subtotal).toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      remove(item)
                    }
                    className="rounded-lg p-2 text-red-400 hover:bg-red-50"
                    aria-label={`Remover ${item.product_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          item,
                          -1
                        )
                      }
                      disabled={
                        item.quantity <= 1
                      }
                      className="p-2 disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="w-8 text-center text-sm">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        update(
                          item,
                          1
                        )
                      }
                      disabled={
                        item.product &&
                        item.quantity >=
                          item.product.quantity
                      }
                      className="p-2 disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky top-24 h-fit rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="font-semibold text-[#0D1273]">
              Resumo
            </h2>

            <div className="mt-4 flex justify-between text-sm">
              <span className="text-gray-500">
                Subtotal
              </span>

              <span className="font-medium">
                R$ {total.toFixed(2)}
              </span>
            </div>

            <div className="my-4 border-t border-gray-100" />

            <div className="mb-5 flex justify-between">
              <span className="font-semibold text-[#0D1273]">
                Total
              </span>

              <span className="text-xl font-bold text-[#0D1273]">
                R$ {total.toFixed(2)}
              </span>
            </div>

            <Button
              className="w-full"
              onClick={() =>
                navigate(
                  '/checkout'
                )
              }
            >
              Continuar para checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className="mt-4 text-center text-xs text-gray-400">
              <Fish className="mr-1 inline h-3 w-3" />
              Promoções são revalidadas novamente no checkout.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
