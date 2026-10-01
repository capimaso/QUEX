import React, { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import { useAuth } from '@/lib/AuthContext'
import { initialUrlError } from '@/lib/supabase'

// Pra onde voltam o link de confirmação de e-mail e o login com Google.
// O Supabase já pegou a sessão da URL; aqui só decidimos pra onde mandar.
export default function AuthCallback() {
  const { user, needsProfile } = useAuth()

  useEffect(() => { if (user) toast.success('Tudo certo, você está logado!') }, [user])

  if (needsProfile) return <Navigate to="/complete-profile" replace />
  if (user) return <Navigate to="/" replace />

  return (
    <AuthLayout icon={AlertTriangle} title="Link inválido" subtitle="Não deu pra concluir o acesso" footer={<Link to="/login" className="text-[#0D1273] font-medium hover:underline">Ir para o login</Link>}>
      <p className="text-sm text-gray-600 text-center">
        {initialUrlError ? initialUrlError : 'Esse link expirou ou já foi usado.'}{' '}
        Se você acabou de se cadastrar, tenta entrar normalmente: se o e-mail já foi confirmado vai funcionar. Senão, peça um novo e-mail de confirmação na tela de login.
      </p>
    </AuthLayout>
  )
}
