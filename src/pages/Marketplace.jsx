import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Bone,
  Fish,
  MapPinned,
  Search,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react'
import ProductCard from '@/components/products/ProductCard'
import LoadingFish from '@/components/LoadingFish'
import {
  Badge,
  Button,
  InputWithIcon,
  Select,
} from '@/components/ui'
import { listProducts } from '@/api/data'
import { useAuth } from '@/lib/AuthContext'

export default function Marketplace() {
  const { user } = useAuth()

  const [products, setProducts] =
    useState([])
  const [loading, setLoading] =
    useState(true)
  const [search, setSearch] =
    useState('')
  const [
    speciesFilter,
    setSpeciesFilter,
  ] = useState('')
  const [
    boneFilter,
    setBoneFilter,
  ] = useState('')
  const [
    waterFilter,
    setWaterFilter,
  ] = useState('')
  const [sortBy, setSortBy] =
    useState('relevance')
  const [
    showFilters,
    setShowFilters,
  ] = useState(false)
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
          listProducts({
            search,
            nearMe:
              nearMe &&
              canUseNearMe,
          })
            .then(list => {
              if (active) {
                setProducts(list)
              }
            })
            .catch(error => {
              console.error(
                '[QUÉX] Erro na busca de produtos:',
                error
              )
            })
            .finally(() => {
              if (active) {
                setLoading(false)
              }
            })
        },
        search.trim()
          ? 250
          : 0
      )

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [
    search,
    nearMe,
    canUseNearMe,
  ])

  const species = useMemo(
    () =>
      [
        ...new Set(
          products
            .map(
              product =>
                product.species
            )
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        a.localeCompare(
          b,
          'pt-BR'
        )
      ),
    [products]
  )

  const filtered = useMemo(
    () =>
      [...products]
        .filter(product => {
          if (
            speciesFilter &&
            product.species !==
              speciesFilter
          ) {
            return false
          }

          if (
            boneFilter &&
            String(
              product.has_bones
            ) !== boneFilter
          ) {
            return false
          }

          if (
            waterFilter &&
            product.water_type !==
              waterFilter
          ) {
            return false
          }

          return true
        })
        .sort((a, b) => {
          if (
            sortBy ===
            'price_asc'
          ) {
            return (
              Number(
                a.effective_price ??
                  a.price
              ) -
              Number(
                b.effective_price ??
                  b.price
              )
            )
          }

          if (
            sortBy ===
            'price_desc'
          ) {
            return (
              Number(
                b.effective_price ??
                  b.price
              ) -
              Number(
                a.effective_price ??
                  a.price
              )
            )
          }

          if (
            sortBy ===
            'newest'
          ) {
            return b.id - a.id
          }

          /*
            relevance:
            mantém exatamente a ordem calculada pelo backend.
          */
          return 0
        }),
    [
      products,
      speciesFilter,
      boneFilter,
      waterFilter,
      sortBy,
    ]
  )

  const clear = () => {
    setSearch('')
    setSpeciesFilter('')
    setBoneFilter('')
    setWaterFilter('')
    setSortBy('relevance')
    setNearMe(false)
  }

  const hasFilters = Boolean(
    search ||
      speciesFilter ||
      boneFilter ||
      waterFilter ||
      nearMe ||
      sortBy !== 'relevance'
  )

  const toggleNearMe = () => {
    if (!canUseNearMe) {
      return
    }

    setNearMe(
      value => !value
    )
    setSortBy('relevance')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Marketplace
        </h1>

        <p className="mt-1 text-gray-500">
          Os resultados começam pelos anúncios mais relevantes para você.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <InputWithIcon
          icon={Search}
          type="search"
          wrapperClassName="flex-1"
          placeholder="Buscar peixe, iguaria, espécie ou vendedor..."
          value={search}
          onChange={event =>
            setSearch(
              event.target.value
            )
          }
        />

        <Button
          variant={
            nearMe
              ? 'primary'
              : 'outline'
          }
          onClick={toggleNearMe}
          disabled={!canUseNearMe}
          title={
            canUseNearMe
              ? 'Priorizar vendedores da sua cidade'
              : 'Cadastre cidade e UF no seu perfil para usar este filtro'
          }
        >
          <MapPinned className="mr-2 h-4 w-4" />
          Perto de mim
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            setShowFilters(
              value => !value
            )
          }
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      {nearMe &&
        canUseNearMe && (
          <div className="mb-4 rounded-xl bg-[#5A5FBF]/10 px-4 py-3 text-sm text-[#0D1273]">
            Priorizando anúncios de{' '}
            <strong>
              {user.cidade} -{' '}
              {user.uf}
            </strong>
            .
          </div>
        )}

      {showFilters && (
        <div className="mb-6 grid grid-cols-1 items-end gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Espécie
            </label>

            <Select
              value={
                speciesFilter
              }
              onChange={event =>
                setSpeciesFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas
              </option>

              {species.map(item => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Espinha
            </label>

            <Select
              value={boneFilter}
              onChange={event =>
                setBoneFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Tanto faz
              </option>
              <option value="true">
                Com espinha
              </option>
              <option value="false">
                Sem espinha
              </option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Tipo de água
            </label>

            <Select
              value={waterFilter}
              onChange={event =>
                setWaterFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos
              </option>
              <option value="doce">
                Água doce
              </option>
              <option value="salgada">
                Água salgada
              </option>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Ordenar por
            </label>

            <Select
              value={sortBy}
              onChange={event =>
                setSortBy(
                  event.target.value
                )
              }
              disabled={nearMe}
            >
              <option value="relevance">
                Mais relevantes
              </option>
              <option value="newest">
                Mais recentes
              </option>
              <option value="price_asc">
                Menor preço
              </option>
              <option value="price_desc">
                Maior preço
              </option>
            </Select>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="justify-self-start text-red-500"
            >
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      )}

      {hasFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
            <Bone className="mr-1 h-3 w-3" />
            Filtros ativos
          </Badge>

          {waterFilter && (
            <Badge className="bg-[#0D1273]/5 text-[#0D1273]">
              <Waves className="mr-1 h-3 w-3" />
              {waterFilter ===
              'doce'
                ? 'Água doce'
                : 'Água salgada'}
            </Badge>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingFish
            size="lg"
            label="Buscando pescados..."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <Fish className="mx-auto mb-4 h-16 w-16 opacity-30" />
          <p className="text-lg font-medium">
            Nenhum produto encontrado
          </p>
          <p className="mt-1 text-sm">
            Tente ajustar sua busca ou filtros.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-400">
            {filtered.length}{' '}
            produto
            {filtered.length !== 1
              ? 's'
              : ''}{' '}
            encontrado
            {filtered.length !== 1
              ? 's'
              : ''}
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(
              product => (
                <ProductCard
                  key={product.id}
                  product={
                    product
                  }
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
