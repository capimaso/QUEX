import React, {
  useEffect,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Fish,
  ShoppingBag,
  Truck,
} from 'lucide-react'
import ProductCard from '@/components/products/ProductCard'
import LoadingFish from '@/components/LoadingFish'
import ParallaxHero from '@/components/ParallaxHero'
import { listProducts } from '@/api/data'

const BENEFITS = [
  {
    icon: Fish,
    title: 'Pescado do Dia',
    desc:
      'Peixes e iguarias anunciados por vendedores locais, com informações claras sobre o produto.',
  },
  {
    icon: ShoppingBag,
    title: 'Preço Direto',
    desc:
      'Veja o valor do anúncio e compre diretamente de quem vende o pescado.',
  },
  {
    icon: Truck,
    title: 'Entrega em Casa',
    desc:
      'Informe seu endereço no checkout e acompanhe o andamento do pedido.',
  },
]

export default function Home() {
  const [featured, setFeatured] =
    useState([])
  const [loading, setLoading] =
    useState(true)

  useEffect(() => {
    let active = true

    listProducts()
      .then(products => {
        if (active) {
          setFeatured(products)
        }
      })
      .catch(error => {
        console.error(
          '[QUÉX] Não foi possível carregar os destaques:',
          error
        )
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen">
      <ParallaxHero>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-32 lg:px-8">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-sm">
              <Fish className="h-4 w-4" />
              <span>
                Pescado fresco, direto do mar para sua mesa
              </span>
            </div>

            <h1 className="text-4xl font-heading font-bold leading-tight md:text-6xl">
              Compre pescado fresco
              <span className="gradient-text block">
                direto do pescador
              </span>
            </h1>

            <p className="max-w-lg text-lg text-blue-100">
              O QUÉX conecta você a pescadores artesanais locais.
              Encontre peixes e iguarias frescas com preços transparentes
              e sem intermediários desnecessários.
            </p>

            <Link
              to="/marketplace"
              className="inline-flex"
            >
              <button className="gradient-btn flex items-center gap-2 rounded-xl px-6 py-3 text-sm transition-all duration-200 ease-in-out">
                Ver Marketplace
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </ParallaxHero>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {BENEFITS.map(item => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="group rounded-2xl p-6 text-center transition-all duration-300 ease-in-out hover:bg-[#5A5FBF]/5"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0D1273] transition-transform duration-300 ease-in-out group-hover:scale-105">
                    <Icon className="h-7 w-7 text-white" />
                  </div>

                  <h3 className="mb-2 text-lg font-heading font-semibold text-[#0D1273]">
                    {item.title}
                  </h3>

                  <p className="text-sm text-gray-500">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
                Pescado Fresco Hoje
              </h2>

              <p className="mt-1 text-gray-500">
                Confira os anúncios mais recentes
              </p>
            </div>

            <Link
              to="/marketplace"
              className="hidden items-center gap-1 text-sm font-medium text-[#0D1273] transition-colors duration-200 hover:underline md:flex"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingFish
                size="lg"
                label="Carregando pescados..."
              />
            </div>
          ) : featured.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Fish className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-lg">
                Nenhum produto cadastrado ainda
              </p>
              <p className="mt-1 text-sm">
                Cadastre um produto pela área de vendedor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured
                .slice(0, 6)
                .map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
