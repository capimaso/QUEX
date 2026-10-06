import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import Footer from './Footer'
import { cartCount } from '@/api/data'
import { useAuth } from '@/lib/AuthContext'

export default function AppLayout() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const tipo = String(user?.tipo || '').toLowerCase()
    const isBuyer =
      tipo === 'comprador' ||
      (user?.role === 'buyer' && !['ceo', 'adm'].includes(tipo))

    if (!user || !isBuyer) {
      setCount(0)
      return
    }

    cartCount()
      .then(setCount)
      .catch(() => setCount(0))
  }, [user])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <NavBar user={user} cartCount={count} />

      <main className="flex-1">
        <Outlet
          context={{
            user,
            cartCount: count,
            setCartCount: setCount,
          }}
        />
      </main>

      <Footer />
    </div>
  )
}
