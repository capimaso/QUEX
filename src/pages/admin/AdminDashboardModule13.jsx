import React from 'react'
import PlatformConfigPanel from '@/pages/admin/PlatformConfigPanel'
import MessageReportsPanel from '@/pages/admin/MessageReportsPanel'
import FinalAdjustmentsPanel from '@/pages/admin/FinalAdjustmentsPanel'
import AdminDashboard from '@/pages/admin/AdminDashboard'

export default function AdminDashboardModule13() {
  return (
    <>
      <PlatformConfigPanel />
      <FinalAdjustmentsPanel />
      <MessageReportsPanel />
      <AdminDashboard />
    </>
  )
}
