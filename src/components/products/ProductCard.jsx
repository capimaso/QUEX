import React from 'react'
import { Link } from 'react-router-dom'
import {
  Bone,
  Fish,
  MapPin,
  Waves,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import {
  fallbackImage,
} from '@/api/data'

const unitLabel = unit =>
  unit === 'unidade'
    ? 'unid.'
    : unit === 'duzia'
      ? 'dúzia'
      : 'kg'

export default function ProductCard({
  product,
}) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="quex-card-motion group overflow-hidden rounded-2xl border border-gray-100 bg-white hover:border-[#5A5FBF]/40 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={
            product.image_url ||
            fallbackImage
          }
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
          loading="lazy"
          onError={event => {
            event.currentTarget.src =
              fallbackImage
          }}
        />

        {product.quantity <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-sm font-semibold text-white">
              Sem Estoque
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.species && (
            <Badge className="bg-white/90 text-[#0D1273]">
              <Fish className="mr-1 h-3 w-3" />
              {product.species}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-1 font-semibold text-[#0D1273] transition-colors duration-200 ease-in-out group-hover:text-[#5A5FBF]">
          {product.name}
        </h3>

        <p className="line-clamp-2 text-xs text-gray-500">
          {product.description ||
            'Produto fresco anunciado por vendedor local.'}
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
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
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div>
            <span className="text-xl font-bold text-[#0D1273]">
              R${' '}
              {product.price.toFixed(2)}
            </span>

            <span className="ml-1 text-xs text-gray-400">
              /
              {unitLabel(
                product.unit
              )}
            </span>
          </div>

          <span className="flex max-w-[46%] items-center gap-1 truncate text-xs text-gray-400">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {product.seller_name}
          </span>
        </div>
      </div>
    </Link>
  )
}
