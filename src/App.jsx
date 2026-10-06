import React from 'react'
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import {
  AuthProvider,
  useAuth,
} from '@/lib/AuthContext'
import {
  PreferencesProvider,
} from '@/lib/PreferencesContext'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import SupportWidget from '@/components/SupportWidget'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ClaimCpf from '@/pages/ClaimCpf'
import VerifyEmail from '@/pages/VerifyEmail'
import AuthCallback from '@/pages/AuthCallback'
import CompleteProfile from '@/pages/CompleteProfile'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Home from '@/pages/Home'
import Marketplace from '@/pages/Marketplace'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import Orders from '@/pages/Orders'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'
import Sellers from '@/pages/Sellers'
import PublicProfile from '@/pages/PublicProfile'
import Privacy from '@/pages/Privacy'
import Terms from '@/pages/Terms'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import SellerDashboard from '@/pages/seller/SellerDashboard'
import ProductForm from '@/pages/seller/ProductForm'
import NotFound from '@/pages/NotFound'

function Gate() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#5A5FBF]/20 border-t-[#0D1273]" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />
      <Route
        path="/register"
        element={<Register />}
      />
      <Route
        path="/claim-cpf"
        element={<ClaimCpf />}
      />
      <Route
        path="/verify-email"
        element={<VerifyEmail />}
      />
      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />
      <Route
        path="/complete-profile"
        element={<CompleteProfile />}
      />
      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />
      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Home />}
          />
          <Route
            path="/marketplace"
            element={<Marketplace />}
          />
          <Route
            path="/product/:id"
            element={<ProductDetail />}
          />
          <Route
            path="/cart"
            element={<Cart />}
          />
          <Route
            path="/checkout"
            element={<Checkout />}
          />
          <Route
            path="/orders"
            element={<Orders />}
          />
          <Route
            path="/profile"
            element={<Profile />}
          />
          <Route
            path="/settings"
            element={<Settings />}
          />
          <Route
            path="/sellers"
            element={<Sellers />}
          />
          <Route
            path="/sellers/:id"
            element={<PublicProfile />}
          />
          <Route
            path="/buyers/:id"
            element={<PublicProfile />}
          />
          <Route
            path="/privacy"
            element={<Privacy />}
          />
          <Route
            path="/terms"
            element={<Terms />}
          />

          <Route element={<AdminRoute />}>
            <Route
              path="/admin"
              element={
                <AdminDashboard />
              }
            />
          </Route>

          <Route
            path="/seller/dashboard"
            element={
              <SellerDashboard />
            }
          />
          <Route
            path="/seller/product/:id"
            element={
              <ProductForm />
            }
          />
        </Route>
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="*"
        element={<NotFound />}
      />
    </Routes>
  )
}

function AppContent() {
  return (
    <>
      <Gate />
      <SupportWidget />
    </>
  )
}

export default function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </PreferencesProvider>
  )
}
