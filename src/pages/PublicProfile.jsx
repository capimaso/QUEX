import React, { useEffect, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom'
import {
  ArrowLeft,
  Fish,
  Flag,
  MapPin,
  Pencil,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import LoadingFish from '@/components/LoadingFish'
import StarRating from '@/components/StarRating'
import RatingBars from '@/components/RatingBars'
import ProductCard from '@/components/products/ProductCard'
import ReportModal from '@/components/ReportModal'
import { Badge, Button } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { getPerson, listProducts } from '@/api/data'

export default function PublicProfile() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [person, setPerson] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setPerson(null)
    setProducts([])

    getPerson(id)
      .then(async item => {
        if (!active) return
        setPerson(item)

        if (item.role === 'seller') {
          const list = await listProducts({
            sellerId: item.id,
          }).catch(() => [])

          if (active) setProducts(list)
        }
      })
      .catch(errorValue => {
        if (active) {
          setError(
            errorValue.status === 404
              ? 'Perfil não encontrado.'
              : errorValue.message ||
                'Não foi possível carregar o perfil.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-28">
        <LoadingFish
          size="lg"
          label="Carregando perfil..."
        />
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-gray-500">
        {error || 'Perfil não encontrado.'}
        <div className="mt-4">
          <Link
            to="/sellers"
            className="font-medium text-[#0D1273] hover:underline"
          >
            Ver vendedores
          </Link>
        </div>
      </div>
    )
  }

  const isSeller = person.role === 'seller'
  const expected = `/${isSeller ? 'sellers' : 'buyers'}/${person.id}`

  if (!pathname.startsWith(expected)) {
    return <Navigate to={expected} replace />
  }

  const mine = Number(user?.id) === Number(person.id)

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/sellers"
          className="mb-6 inline-flex items-center text-sm text-gray-500 hover:text-[#0D1273]"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Vendedores
        </Link>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar
              src={person.foto_url}
              name={person.name}
              size={112}
            />

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
                  {person.name}
                </h1>

                <Badge className="bg-[#5A5FBF]/10 text-[#0D1273]">
                  {isSeller ? 'Vendedor' : 'Comprador'}
                </Badge>
              </div>

              {person.responsible && (
                <p className="text-sm text-gray-500">
                  Responsável: {person.responsible}
                </p>
              )}

              {person.localizacao && (
                <p className="flex items-center gap-1 text-gray-500">
                  <MapPin className="h-4 w-4" />
                  {person.localizacao}
                </p>
              )}

              <StarRating
                average={person.rating.average}
                count={person.rating.count}
                size={18}
              />

              {person.rating.count > 0 && (
                <RatingBars
                  distribution={person.rating.distribution}
                  count={person.rating.count}
                />
              )}
            </div>

            {mine ? (
              <Link to="/profile">
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar perfil
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReportOpen(true)}
                className="text-red-600 hover:bg-red-50"
              >
                <Flag className="mr-2 h-4 w-4" />
                Denunciar
              </Button>
            )}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <h2 className="mb-2 font-semibold text-[#0D1273]">
              Sobre
            </h2>
            <p className="whitespace-pre-line text-gray-600">
              {person.bio ||
                (mine
                  ? 'Você ainda não escreveu uma biografia.'
                  : 'Ainda sem biografia.')}
            </p>
          </div>
        </div>

        {isSeller && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-heading font-bold text-[#0D1273]">
              Produtos
            </h2>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-400">
                <Fish className="mx-auto mb-2 h-8 w-8" />
                <p>Nenhum produto à venda no momento.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reporterId={user?.id}
        reportedUserId={person.id}
        contextLabel={`Perfil: ${person.name}`}
      />
    </>
  )
}
