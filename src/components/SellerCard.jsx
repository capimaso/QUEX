import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import Avatar from '@/components/Avatar'
import StarRating from '@/components/StarRating'

export default function SellerCard({
  seller,
}) {
  return (
    <Link
      to={`/sellers/${seller.id}`}
      className="quex-card-motion group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 hover:border-[#5A5FBF]/40 hover:shadow-xl"
    >
      <div className="flex items-center gap-4">
        <Avatar
          src={seller.foto_url}
          name={seller.name}
          size={64}
        />

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[#0D1273] group-hover:underline">
            {seller.name}
          </h3>

          {seller.localizacao && (
            <p className="flex items-center gap-1 truncate text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {seller.localizacao}
            </p>
          )}
        </div>
      </div>

      <StarRating
        average={
          seller.rating.average
        }
        count={seller.rating.count}
      />

      <p className="min-h-[2.5rem] line-clamp-2 text-sm text-gray-500">
        {seller.bio ||
          'Esse vendedor ainda não escreveu uma biografia.'}
      </p>
    </Link>
  )
}
