import React from 'react'
import { Navigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

export default function AdminPlaceholder() {
  const { user } = useAuth()
  const tipo = String(user?.tipo || '').toLowerCase()
  const allowed = tipo === 'ceo' || tipo === 'adm'
  if (!allowed) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5A5FBF]/10 text-[#0D1273]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-[#0D1273]">Painel Administrativo</h1>
        <p className="mt-3 text-gray-500">
          A estrutura de navegação já está pronta. O painel completo será implementado no Módulo 8.
        </p>
      </div>
    </div>
  )
}
