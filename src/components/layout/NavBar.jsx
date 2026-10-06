import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  Fish,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  User,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/AuthContext'

export default function NavBar({ user, cartCount = 0 }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const { logout } = useAuth()
  const location = useLocation()

  const tipo = String(user?.tipo || '').toLowerCase()
  const isSeller = tipo === 'vendedor' || user?.role === 'seller'
  const isAdmin = tipo === 'ceo' || tipo === 'adm'
  const isBuyer = !isSeller && !isAdmin

  const closeAll = () => {
    setMobileOpen(false)
    setUserMenuOpen(false)
  }

  useEffect(() => {
    const onPointerDown = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    closeAll()
  }, [location.pathname])

  const linkClass = path =>
    `text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'text-[#0D1273] font-semibold'
        : 'text-gray-600 hover:text-[#0D1273]'
    }`

  const dropdownLink =
    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-[#5A5FBF]/10 hover:text-[#0D1273]'

  const accountLabel = isAdmin
    ? tipo.toUpperCase()
    : isSeller
      ? 'Vendedor'
      : 'Comprador'

  return (
    <nav className="quex-navbar sticky top-0 z-50 border-b border-[#5A5FBF]/20 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2" onClick={closeAll}>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D1273]">
                <Fish className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-heading font-bold tracking-tight text-[#0D1273]">QUÉX</span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              <Link to="/marketplace" className={linkClass('/marketplace')}>Marketplace</Link>
              <Link to="/sellers" className={linkClass('/sellers')}>Vendedores</Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isBuyer && (
              <Link
                to="/cart"
                className="relative rounded-lg p-2 transition hover:bg-[#5A5FBF]/10"
                aria-label="Abrir carrinho"
              >
                <ShoppingCart className="h-5 w-5 text-[#0D1273]" />
                {cartCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center bg-[#0D1273] px-1 text-white">
                    {cartCount}
                  </Badge>
                )}
              </Link>
            )}

            <div
              ref={menuRef}
              className="relative"
              onMouseEnter={() => {
                if (window.matchMedia('(min-width: 768px)').matches) {
                  setUserMenuOpen(true)
                }
              }}
              onMouseLeave={() => {
                if (window.matchMedia('(min-width: 768px)').matches) {
                  setUserMenuOpen(false)
                }
              }}
            >
              <button
                type="button"
                onClick={() => setUserMenuOpen(value => !value)}
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[#5A5FBF]/10 sm:px-3"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <Avatar src={user?.foto_url} name={user?.full_name} size={32} />

                <div className="hidden max-w-36 text-left sm:block">
                  <p className="truncate text-xs font-medium text-[#0D1273]">
                    {user?.full_name || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-gray-400">{accountLabel}</p>
                </div>

                <ChevronDown
                  className={`hidden h-4 w-4 text-gray-400 transition sm:block ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {userMenuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
                  <div className="border-b border-gray-100 px-3 py-2 sm:hidden">
                    <p className="truncate text-sm font-semibold text-[#0D1273]">
                      {user?.full_name || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-400">{accountLabel}</p>
                  </div>

                  <Link to="/profile" className={dropdownLink} role="menuitem">
                    <User className="h-4 w-4" />Meu perfil
                  </Link>

                  <Link to="/settings" className={dropdownLink} role="menuitem">
                    <Settings className="h-4 w-4" />Configurações
                  </Link>

                  <Link to="/orders" className={dropdownLink} role="menuitem">
                    <Package className="h-4 w-4" />Pedidos
                  </Link>

                  {isAdmin && (
                    <Link to="/admin" className={dropdownLink} role="menuitem">
                      <ShieldCheck className="h-4 w-4" />Painel Administrativo
                    </Link>
                  )}

                  <div className="my-1 border-t border-gray-100" />

                  <button
                    type="button"
                    onClick={async () => {
                      closeAll()
                      await logout()
                    }}
                    className={`${dropdownLink} text-red-600 hover:bg-red-50 hover:text-red-700`}
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />Sair
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rounded-lg p-2 transition hover:bg-[#5A5FBF]/10 md:hidden"
              onClick={() => setMobileOpen(value => !value)}
              aria-label="Abrir navegação"
            >
              {mobileOpen ? (
                <X className="h-5 w-5 text-[#0D1273]" />
              ) : (
                <Menu className="h-5 w-5 text-[#0D1273]" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="space-y-1 border-t border-gray-100 pb-4 pt-3 md:hidden">
            <Link
              to="/marketplace"
              onClick={closeAll}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"
            >
              Marketplace
            </Link>

            <Link
              to="/sellers"
              onClick={closeAll}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-[#5A5FBF]/10"
            >
              <Store className="h-4 w-4" />Vendedores
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
