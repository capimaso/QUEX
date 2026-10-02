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

  // "Unable to exchange external code" = o Supabase não conseguiu trocar o código com o Google
  // (quase sempre Client ID/Secret errado em Authentication > Providers > Google).
  const googleFail = /exchange external code|oauth|provider/i.test(initialUrlError || '')
  return (
    <AuthLayout icon={AlertTriangle} title={googleFail ? 'Falha no login com Google' : 'Link inválido'} subtitle="Não deu pra concluir o acesso" footer={<Link to="/login" className="text-[#0D1273] font-medium hover:underline">Ir para o login</Link>}>
      <div className="text-sm text-gray-600 text-center space-y-3">
        {googleFail
          ? <p>O Google não conseguiu confirmar seu acesso. Tenta de novo em instantes; se continuar, entra com e-mail e senha.</p>
          : <p>Esse link expirou ou já foi usado. Se você acabou de se cadastrar, tenta entrar normalmente: se o e-mail já foi confirmado vai funcionar. Senão, peça um novo e-mail de confirmação na tela de login.</p>}
        {initialUrlError && <p className="text-xs text-gray-400 break-words">Detalhe técnico: {initialUrlError}</p>}
      </div>
    </AuthLayout>
  )
}
