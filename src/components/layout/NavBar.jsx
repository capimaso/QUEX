import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShoppingCart, Menu, X, Fish, User, LogOut, Package, Store } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/AuthContext'

export default function NavBar({ user, cartCount = 0 }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout } = useAuth()
  const location = useLocation()
  const isSeller = user?.role === 'seller'
  const linkClass = path => `text-sm font-medium transition-colors ${location.pathname === path ? 'text-[#0D1273] font-semibold' : 'text-gray-600 hover:text-[#0D1273]'}`
  const close = () => setMobileOpen(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#5A5FBF]/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group" onClick={close}>
            <div className="w-9 h-9 rounded-xl bg-[#0D1273] flex items-center justify-center"><Fish className="w-5 h-5 text-white" /></div>
            <span className="text-xl font-heading font-bold text-[#0D1273] tracking-tight">QUÉX</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link to="/marketplace" className={linkClass('/marketplace')}>Comprar Pescados</Link>
            <Link to="/sellers" className={linkClass('/sellers')}>Vendedores</Link>
            {isSeller ? <Link to="/seller/dashboard" className={linkClass('/seller/dashboard')}>Minha Loja</Link> : <Link to="/orders" className={linkClass('/orders')}>Meus Pedidos</Link>}
            <Link to="/profile" className={linkClass('/profile')}>Perfil</Link>
          </div>

          <div className="flex items-center gap-2">
            {!isSeller && (
              <Link to="/cart" className="relative p-2 rounded-lg hover:bg-[#5A5FBF]/10">
                <ShoppingCart className="w-5 h-5 text-[#0D1273]" />
                {cartCount > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1 bg-[#0D1273] text-white">{cartCount}</Badge>}
              </Link>
            )}
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <Avatar src={user?.foto_url} name={user?.full_name} size={28} />
              <div className="max-w-32">
                <p className="text-xs font-medium text-[#0D1273] truncate">{user?.full_name || 'Usuário'}</p>
                <p className="text-[10px] text-gray-400">{isSeller ? 'Vendedor' : 'Comprador'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="!px-2" onClick={logout} title="Sair"><LogOut className="w-4 h-4" /></Button>
            <button className="md:hidden p-2 rounded-lg hover:bg-[#5A5FBF]/10" onClick={() => setMobileOpen(v => !v)} aria-label="Abrir menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            <Link to="/marketplace" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10">Comprar Pescados</Link>
            <Link to="/sellers" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"><Store className="inline w-4 h-4 mr-2" />Vendedores</Link>
            {isSeller ? (
              <Link to="/seller/dashboard" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"><Store className="inline w-4 h-4 mr-2" />Minha Loja</Link>
            ) : (
              <>
                <Link to="/cart" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"><ShoppingCart className="inline w-4 h-4 mr-2" />Carrinho ({cartCount})</Link>
                <Link to="/orders" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"><Package className="inline w-4 h-4 mr-2" />Meus Pedidos</Link>
              </>
            )}
            <Link to="/profile" onClick={close} className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"><User className="inline w-4 h-4 mr-2" />Perfil</Link>
          </div>
        )}
      </div>
    </nav>
  )
}
