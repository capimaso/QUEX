import React from 'react'
import {
  Navigate,
  Outlet,
} from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'

export default function AdminRoute() {
  const { user } = useAuth()
  const level = String(
    user?.access_level || 'comum'
  ).toLowerCase()

  if (
    level !== 'adm' &&
    level !== 'ceo'
  ) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
