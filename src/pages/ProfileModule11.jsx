import React from 'react'
import Profile from '@/pages/Profile'
import SellerFreightSettings from '@/components/SellerFreightSettings'
import { useAuth } from '@/lib/AuthContext'

export default function ProfileModule11() {
  const { user } = useAuth()

  return (
    <>
      <Profile />
      {user?.role === 'seller' && (
        <SellerFreightSettings />
      )}
    </>
  )
}
