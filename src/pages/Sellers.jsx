import React, {
  useEffect,
  useState,
} from 'react'
import {
  MapPin,
  Search,
  Store,
} from 'lucide-react'
import SellerCard from '@/components/SellerCard'
import LoadingFish from '@/components/LoadingFish'
import {
  Button,
  InputWithIcon,
} from '@/components/ui'
import { listSellers } from '@/api/data'


const PAGE = 24

export default function Sellers() {
  const [name, setName] =
    useState('')
  const [place, setPlace] =
    useState('')
  const [sellers, setSellers] =
    useState([])
  const [loading, setLoading] =
    useState(true)
  const [more, setMore] =
    useState(false)
  const [error, setError] =
    useState('')

  useEffect(() => {
    let active = true
    setLoading(true)

    const timer = window.setTimeout(
      () => {
        listSellers({
          search: name,
          location: place,
          limit: PAGE,
        })
          .then(list => {
            if (!active) return
            setSellers(list)
            setMore(
              list.length === PAGE
            )
            setError('')
          })
          .catch(err => {
            if (active) {
              setError(
                err.message ||
                  'Não foi possível carregar os vendedores.'
              )
            }
          })
          .finally(() => {
            if (active) {
              setLoading(false)
            }
          })
      },
      350
    )

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [name, place])

  const loadMore = async () => {
    const next =
      await listSellers({
        search: name,
        location: place,
        limit: PAGE,
        offset: sellers.length,
      })

    setSellers(previous => [
      ...previous,
      ...next,
    ])

    setMore(
      next.length === PAGE
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Vendedores
        </h1>

        <p className="mt-1 text-gray-500">
          Encontre pescadores e peixarias pelo nome ou pela região.
        </p>
      </div>

      <div className="mb-8 grid max-w-2xl gap-3 sm:grid-cols-2">
        <InputWithIcon
          icon={Search}
          type="search"
          value={name}
          onChange={event =>
            setName(event.target.value)
          }
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
        />

        <InputWithIcon
          icon={MapPin}
          type="search"
          value={place}
          onChange={event =>
            setPlace(event.target.value)
          }
          placeholder="Cidade ou região"
          aria-label="Buscar por localização"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingFish
            size="lg"
            label="Carregando vendedores..."
          />
        </div>
      ) : sellers.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Store className="mx-auto mb-3 h-10 w-10" />
          <p>
            Nenhum vendedor encontrado.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map(seller => (
              <SellerCard
                key={seller.id}
                seller={seller}
              />
            ))}
          </div>

          {more && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={loadMore}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
