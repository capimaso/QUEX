import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './NavBar'
import { cartCount } from '@/api/data'
import { useAuth } from '@/lib/AuthContext'

export default function AppLayout() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)
  useEffect(() => { if (!user || user.role === 'seller') return setCount(0); cartCount().then(setCount).catch(() => setCount(0)) }, [user])
  return <div className="min-h-screen bg-gray-50/50"><NavBar user={user} cartCount={count} /><main><Outlet context={{ user, cartCount: count, setCartCount: setCount }} /></main></div>
}
