import React, {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  ArrowLeft,
  Bone,
  Fish,
  Flag,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Waves,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  addToCart,
  fallbackImage,
  getProduct,
} from '@/api/data'
import LoadingFish from '@/components/LoadingFish'
import ProductGallery from '@/components/products/ProductGallery'
import ReportModal from '@/components/ReportModal'
import {
  Badge,
  Button,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const unitLabel = unit =>
  unit === 'unidade'
    ? 'unidade'
    : unit === 'duzia'
      ? 'dúzia'
      : 'kg'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [product, setProduct] =
    useState(null)
  const [loading, setLoading] =
    useState(true)
  const [qty, setQty] =
    useState(1)
  const [adding, setAdding] =
    useState(false)
  const [reportOpen, setReportOpen] =
    useState(false)

  useEffect(() => {
    setLoading(true)

    getProduct(id)
      .then(setProduct)
      .catch(error =>
        toast.error(
          error.message
        )
      )
      .finally(() =>
        setLoading(false)
      )
  }, [id])

  const add = async () => {
    if (
      user?.role !==
      'buyer'
    ) {
      return toast.error(
        'Somente compradores podem adicionar itens ao carrinho.'
      )
    }

    setAdding(true)

    try {
      await addToCart(
        user,
        product,
        qty
      )

      toast.success(
        'Adicionado ao carrinho!'
      )

      navigate('/cart')
    } catch (error) {
      toast.error(
        error.message
      )
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <LoadingFish
          size="lg"
          label="Carregando anúncio..."
        />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <Fish className="mx-auto mb-4 h-16 w-16 text-gray-300" />

        <h2 className="text-xl font-semibold text-gray-600">
          Produto não encontrado
        </h2>

        <Button
          variant="ghost"
          onClick={() =>
            navigate(
              '/marketplace'
            )
          }
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Marketplace
        </Button>
      </div>
    )
  }

  const inStock =
    product.quantity > 0

  const canReport =
    user?.id != null &&
    Number(user.id) !==
      Number(
        product.seller_id
      )

  const currentPrice =
    Number(
      product.effective_price ??
        product.price
    )

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() =>
            navigate(-1)
          }
          className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-[#0D1273]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <ProductGallery
            images={
              product.images
            }
            alt={product.name}
            fallback={
              fallbackImage
            }
          />

          <div className="space-y-6">
            <div>
              {product.species && (
                <Badge className="gradient-bg mb-3 text-white">
                  <Fish className="mr-1 h-3 w-3" />
                  {product.species}
                </Badge>
              )}

              <div className="mb-3 flex flex-wrap gap-2">
                <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
                  <Bone className="mr-1 h-3 w-3" />
                  {product.has_bones
                    ? 'Com espinha'
                    : 'Sem espinha'}
                </Badge>

                <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
                  <Waves className="mr-1 h-3 w-3" />
                  {product.water_type ===
                  'salgada'
                    ? 'Água salgada'
                    : 'Água doce'}
                </Badge>

                {product.promotion_active && (
                  <Badge className="bg-[#F2541B] text-white">
                    {product.discount_percent}% OFF
                  </Badge>
                )}
              </div>

              <div className="flex items-start justify-between gap-4">
                <h1 className="text-3xl font-heading font-bold text-[#0D1273]">
                  {product.name}
                </h1>

                {canReport && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setReportOpen(
                        true
                      )
                    }
                    className="shrink-0 text-red-600 hover:bg-red-50"
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    Denunciar
                  </Button>
                )}
              </div>

              <p className="mt-2 flex items-center gap-1 text-gray-500">
                <MapPin className="h-4 w-4" />
                Vendido por{' '}
                <Link
                  to={`/sellers/${product.seller_id}`}
                  className="font-medium text-[#0D1273] hover:underline"
                >
                  {product.seller_name}
                </Link>

                {product.seller_location && (
                  <span className="text-gray-400">
                    • {product.seller_location}
                  </span>
                )}
              </p>
            </div>

            {product.promotion_active ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-lg text-gray-400 line-through">
                    R$ {Number(product.price).toFixed(2)}
                  </span>

                  <Badge className="bg-orange-100 text-orange-700">
                    {product.discount_percent}% OFF
                  </Badge>
                </div>

                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[#F2541B]">
                    R$ {currentPrice.toFixed(2)}
                  </span>

                  <span className="text-gray-400">
                    /{unitLabel(product.unit)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Promoção válida até{' '}
                  {new Intl.DateTimeFormat(
                    'pt-BR',
                    {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }
                  ).format(
                    new Date(
                      product.promotion_expires_at
                    )
                  )}
                  .
                </p>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-[#0D1273]">
                  R$ {Number(product.price).toFixed(2)}
                </span>

                <span className="text-gray-400">
                  /{unitLabel(product.unit)}
                </span>
              </div>
            )}

            <p className="whitespace-pre-line leading-relaxed text-gray-600">
              {product.description ||
                'Este anúncio ainda não possui descrição.'}
            </p>

            <Badge
              className={
                inStock
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }
            >
              {inStock
                ? `${product.quantity} em estoque`
                : 'Sem estoque'}
            </Badge>

            {user?.role ===
              'buyer' && (
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <button
                    disabled={
                      qty <= 1
                    }
                    onClick={() =>
                      setQty(value =>
                        Math.max(
                          1,
                          value - 1
                        )
                      )
                    }
                    className="p-3 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <span className="w-10 text-center font-medium">
                    {qty}
                  </span>

                  <button
                    disabled={
                      qty >=
                      product.quantity
                    }
                    onClick={() =>
                      setQty(value =>
                        Math.min(
                          product.quantity,
                          value + 1
                        )
                      )
                    }
                    className="p-3 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={add}
                  disabled={
                    !inStock ||
                    adding
                  }
                  className="gradient-btn flex flex-1 items-center justify-center gap-2 rounded-xl py-3"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {adding
                    ? 'Adicionando...'
                    : 'Adicionar ao carrinho'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() =>
          setReportOpen(false)
        }
        reporterId={user?.id}
        reportedUserId={
          product.seller_id
        }
        productId={product.id}
        contextLabel={`Produto: ${product.name}`}
      />
    </>
  )
}
