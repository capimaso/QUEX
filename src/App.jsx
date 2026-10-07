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
import LoadingFish from '@/components/LoadingFish'
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
import ProductDetail from '@/pages/ProductDetailModule12'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/CheckoutModule11'
import Orders from '@/pages/OrdersModule11'
import OrderDetail from '@/pages/OrderDetailModule12'
import ChatPage from '@/pages/ChatPage'
import Profile from '@/pages/ProfileModule11'
import Settings from '@/pages/Settings'
import Sellers from '@/pages/Sellers'
import PublicProfile from '@/pages/PublicProfileModule11'
import Privacy from '@/pages/Privacy'
import Terms from '@/pages/Terms'
import AdminDashboard from '@/pages/admin/AdminDashboardModule12'
import SellerDashboard from '@/pages/seller/SellerDashboardModule12'
import ProductForm from '@/pages/seller/ProductForm'
import NotFound from '@/pages/NotFound'

function Gate() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <LoadingFish
        fullscreen
        size="lg"
        label="Preparando o QUÉX..."
      />
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

      {/* O anúncio e seu Q&A são públicos. */}
      <Route
        path="/product/:id"
        element={<ProductDetail />}
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
            path="/orders/:id"
            element={<OrderDetail />}
          />
          <Route
            path="/chat/:chat_id"
            element={<ChatPage />}
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
              element={<AdminDashboard />}
            />
          </Route>

          <Route
            path="/seller/dashboard"
            element={<SellerDashboard />}
          />
          <Route
            path="/seller/product/:id"
            element={<ProductForm />}
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
