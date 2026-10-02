import React from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import Avatar from '@/components/Avatar'
import StarRating from '@/components/StarRating'

export default function SellerCard({ seller }) {
  return (
    <Link to={`/sellers/${seller.id}`} className="group bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 hover:border-[#5A5FBF]/40 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center gap-4">
        <Avatar src={seller.foto_url} name={seller.name} size={64} />
        <div className="min-w-0">
          <h3 className="font-semibold text-[#0D1273] truncate group-hover:underline">{seller.name}</h3>
          {seller.localizacao && <p className="text-sm text-gray-500 flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 flex-shrink-0" />{seller.localizacao}</p>}
        </div>
      </div>
      <StarRating average={seller.rating.average} count={seller.rating.count} />
      <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{seller.bio || 'Esse vendedor ainda não escreveu uma biografia.'}</p>
    </Link>
  )
}
