import React, { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Fish, Flag, MapPin, Pencil } from 'lucide-react'
import Avatar from '@/components/Avatar'
import StarRating from '@/components/StarRating'
import RatingBars from '@/components/RatingBars'
import ProductCard from '@/components/products/ProductCard'
import ReportModal from '@/components/ReportModal'
import { Badge, Button } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { getPerson, listProducts } from '@/api/data'

// Serve /sellers/:id e /buyers/:id (mesmo layout; vendedor também mostra os produtos)
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
      .then(async p => {
        if (!active) return
        setPerson(p)

        if (p.role === 'seller') {
          const list = await listProducts({ sellerId: p.id }).catch(() => [])
          if (active) setProducts(list)
        }
      })
      .catch(e => {
        if (active) {
          setError(
            e.status === 404
              ? 'Perfil não encontrado.'
              : e.message || 'Não foi possível carregar o perfil.'
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  if (error || !person) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">
        {error || 'Perfil não encontrado.'}
        <div className="mt-4">
          <Link
            to="/sellers"
            className="text-[#0D1273] font-medium hover:underline"
          >
            Ver vendedores
          </Link>
        </div>
      </div>
    )
  }

  const isSeller = person.role === 'seller'

  // /buyers/5 que na verdade é vendedor (ou o contrário): manda pra URL certa
  const expected = `/${isSeller ? 'sellers' : 'buyers'}/${person.id}`
  if (!pathname.startsWith(expected)) return <Navigate to={expected} replace />

  const mine = Number(user?.id) === Number(person.id)

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/sellers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-[#0D1273] mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Vendedores
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar src={person.foto_url} name={person.name} size={112} />

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-heading font-bold text-[#0D1273] break-words">
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
                <p className="text-gray-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {person.localizacao}
                </p>
              )}

              <StarRating
                average={person.rating.average}
                count={person.rating.count}
                size={18}
              />

              {person.rating.count > 0 && (
                <div className="mt-3">
                  <RatingBars
                    distribution={person.rating.distribution}
                    count={person.rating.count}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {mine ? (
                <Link to="/profile">
                  <Button variant="outline" size="sm">
                    <Pencil className="w-4 h-4 mr-2" />
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
                  <Flag className="w-4 h-4 mr-2" />
                  Denunciar
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h2 className="font-semibold text-[#0D1273] mb-2">Sobre</h2>
            <p className="text-gray-600 whitespace-pre-line">
              {person.bio ||
                (mine
                  ? 'Você ainda não escreveu uma biografia. Dá pra adicionar no seu perfil.'
                  : 'Ainda sem biografia.')}
            </p>
          </div>
        </div>

        {isSeller && (
          <div className="mt-8">
            <h2 className="text-xl font-heading font-bold text-[#0D1273] mb-4">
              Produtos
            </h2>

            {products.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
                <Fish className="w-8 h-8 mx-auto mb-2" />
                <p>Nenhum produto à venda no momento.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
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
