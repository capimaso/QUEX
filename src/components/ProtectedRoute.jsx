import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function ProtectedRoute() {
  const { user, needsProfile } = useAuth()
  const location = useLocation()
  if (needsProfile) return <Navigate to="/complete-profile" replace />
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}
