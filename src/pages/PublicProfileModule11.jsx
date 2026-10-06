import React, { useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { getPerson } from '@/api/data'
import PublicProfile from '@/pages/PublicProfile'

export default function PublicProfileModule11() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)

  useEffect(() => {
    let active = true

    getPerson(id)
      .then(value => {
        if (active) setPerson(value)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [id])

  return (
    <>
      {person?.role === 'seller' && (
        <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-sm">
            <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]">
              <Truck className="h-4 w-4" />
            </div>

            <div>
              <p className="font-medium text-[#0D1273]">
                {person.delivery_available &&
                person.value_per_km != null
                  ? `Entrega: R$ ${Number(person.value_per_km)
                      .toFixed(2)
                      .replace('.', ',')}/km`
                  : 'Entrega: somente retirada em mãos'}
              </p>

              <p className="mt-0.5 text-xs text-gray-400">
                O valor final de entrega é calculado pela rota no checkout.
              </p>
            </div>
          </div>
        </div>
      )}

      <PublicProfile />
    </>
  )
}
