import React, { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import {
  getPerson,
  getProduct,
} from '@/api/data'
import ProductDetail from '@/pages/ProductDetail'

export default function ProductDetailModule11() {
  const { id } = useParams()
  const [seller, setSeller] = useState(null)

  useEffect(() => {
    let active = true

    getProduct(id)
      .then(product => {
        if (!product?.seller_id) return null
        return getPerson(product.seller_id)
      })
      .then(person => {
        if (active && person) setSeller(person)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [id])

  return (
    <>
      {seller && (
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm text-gray-600">
            <Truck className="h-4 w-4 text-[#0D1273]" />
            {seller.delivery_available &&
            seller.value_per_km != null
              ? `Entrega: R$ ${Number(seller.value_per_km)
                  .toFixed(2)
                  .replace('.', ',')}/km`
              : 'Este vendedor trabalha com retirada em mãos'}
          </div>
        </div>
      )}

      <ProductDetail />
    </>
  )
}
