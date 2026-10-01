import React from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Home from '@/pages/Home'
import Marketplace from '@/pages/Marketplace'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import Orders from '@/pages/Orders'
import Profile from '@/pages/Profile'
import SellerDashboard from '@/pages/seller/SellerDashboard'
import ProductForm from '@/pages/seller/ProductForm'
import NotFound from '@/pages/NotFound'

function Gate() {
  const { loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-10 h-10 rounded-full border-4 border-[#5A5FBF]/20 border-t-[#0D1273] animate-spin" /></div>
  return <Routes><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route element={<ProtectedRoute />}><Route element={<AppLayout />}><Route path="/" element={<Home />} /><Route path="/marketplace" element={<Marketplace />} /><Route path="/product/:id" element={<ProductDetail />} /><Route path="/cart" element={<Cart />} /><Route path="/checkout" element={<Checkout />} /><Route path="/orders" element={<Orders />} /><Route path="/profile" element={<Profile />} /><Route path="/seller/dashboard" element={<SellerDashboard />} /><Route path="/seller/product/:id" element={<ProductForm />} /></Route></Route><Route path="/" element={<Navigate to="/login" replace />} /><Route path="*" element={<NotFound />} /></Routes>
}

export default function App() { return <AuthProvider><Gate /></AuthProvider> }
