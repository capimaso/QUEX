import React from 'react'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import PlatformConfigPanel from '@/pages/admin/PlatformConfigPanel'
import MessageReportsPanel from '@/pages/admin/MessageReportsPanel'

export default function AdminDashboardModule12() {
  return (
    <>
      <PlatformConfigPanel />
      <MessageReportsPanel />
      <AdminDashboard />
    </>
  )
}
