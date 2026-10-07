import React, { useEffect, useState } from 'react'
import {
  Fish,
  LogIn,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { cartCount } from '@/api/data'
import ProductQuestions from '@/components/ProductQuestions'
import Footer from '@/components/layout/Footer'
import NavBar from '@/components/layout/NavBar'
import ProductDetailModule11 from '@/pages/ProductDetailModule11'
import { useAuth } from '@/lib/AuthContext'

function GuestHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#5A5FBF]/20 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/login"
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D1273]">
            <Fish className="h-5 w-5 text-white" />
          </div>

          <span className="text-xl font-heading font-bold tracking-tight text-[#0D1273]">
            QUÉX
          </span>
        </Link>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0D1273] px-4 py-2 text-sm font-semibold text-white"
        >
          <LogIn className="h-4 w-4" />
          Entrar
        </Link>
      </div>
    </header>
  )
}

export default function ProductDetailModule12() {
  const { id } = useParams()
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const isBuyer =
      user?.role === 'buyer' ||
      String(user?.tipo || '').toLowerCase() === 'comprador'

    if (!user || !isBuyer) {
      setCount(0)
      return
    }

    cartCount()
      .then(setCount)
      .catch(() => setCount(0))
  }, [user?.id, user?.role, user?.tipo])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      {user ? (
        <NavBar
          user={user}
          cartCount={count}
        />
      ) : (
        <GuestHeader />
      )}

      <main className="flex-1">
        <ProductDetailModule11 />
        <ProductQuestions productId={id} />
      </main>

      <Footer />
    </div>
  )
}
