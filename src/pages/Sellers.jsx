import React, {
  useEffect,
  useState,
} from 'react'
import {
  MapPin,
  MapPinned,
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
import { useAuth } from '@/lib/AuthContext'

const PAGE = 24

export default function Sellers() {
  const { user } = useAuth()

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
  const [nearMe, setNearMe] =
    useState(false)

  const canUseNearMe =
    Boolean(
      user?.cidade &&
      user?.uf
    )

  useEffect(() => {
    let active = true
    setLoading(true)

    const timer =
      window.setTimeout(
        () => {
          listSellers({
            search: name,
            location: place,
            limit: PAGE,
            nearMe:
              nearMe &&
              canUseNearMe,
          })
            .then(list => {
              if (!active) return

              setSellers(list)
              setMore(
                list.length ===
                  PAGE
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
  }, [
    name,
    place,
    nearMe,
    canUseNearMe,
  ])

  const loadMore =
    async () => {
      const next =
        await listSellers({
          search: name,
          location: place,
          limit: PAGE,
          offset:
            sellers.length,
          nearMe:
            nearMe &&
            canUseNearMe,
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
          Vendedores mais relevantes para você aparecem primeiro.
        </p>
      </div>

      <div className="mb-4 flex max-w-4xl flex-col gap-3 sm:flex-row">
        <InputWithIcon
          icon={Search}
          type="search"
          wrapperClassName="flex-1"
          value={name}
          onChange={event =>
            setName(
              event.target.value
            )
          }
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
        />

        <InputWithIcon
          icon={MapPin}
          type="search"
          wrapperClassName="flex-1"
          value={place}
          onChange={event =>
            setPlace(
              event.target.value
            )
          }
          placeholder="Cidade ou região"
          aria-label="Buscar por localização"
        />

        <Button
          variant={
            nearMe
              ? 'primary'
              : 'outline'
          }
          onClick={() =>
            canUseNearMe &&
            setNearMe(
              value => !value
            )
          }
          disabled={!canUseNearMe}
          title={
            canUseNearMe
              ? 'Priorizar vendedores da sua cidade'
              : 'Cadastre cidade e UF no perfil para usar este filtro'
          }
        >
          <MapPinned className="mr-2 h-4 w-4" />
          Perto de mim
        </Button>
      </div>

      {nearMe &&
        canUseNearMe && (
          <div className="mb-6 rounded-xl bg-[#5A5FBF]/10 px-4 py-3 text-sm text-[#0D1273]">
            Priorizando vendedores de{' '}
            <strong>
              {user.cidade} -{' '}
              {user.uf}
            </strong>
            .
          </div>
        )}

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
            {sellers.map(
              seller => (
                <SellerCard
                  key={seller.id}
                  seller={seller}
                />
              )
            )}
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
