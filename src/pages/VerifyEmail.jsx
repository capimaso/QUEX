import React, { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MailCheck } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import { Button } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

export default function VerifyEmail() {
  const location = useLocation()
  const [params] = useSearchParams()
  const { resendConfirmation } = useAuth()
  const email = location.state?.email || params.get('email') || ''
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const resend = async () => {
    setSending(true)
    try { await resendConfirmation(email); toast.success('E-mail reenviado!'); setCooldown(60) }
    catch (e) { toast.error(e.message) }
    finally { setSending(false) }
  }

  return (
    <AuthLayout icon={MailCheck} title="Confirme seu e-mail" subtitle="Falta só um passinho" footer={<Link to="/login" className="text-[#0D1273] font-medium hover:underline">Voltar para o login</Link>}>
      <div className="text-center space-y-4">
        <p className="text-gray-600 text-sm">Cadastro criado! Enviamos um link de confirmação para{email ? <> <strong className="text-[#0D1273]">{email}</strong></> : ' o seu e-mail'}. Clica nele pra ativar sua conta.</p>
        <p className="text-xs text-gray-400">Não chegou? Olha o spam/lixo eletrônico.</p>
        {email && <Button type="button" variant="outline" className="w-full h-11" disabled={sending || cooldown > 0} onClick={resend}>{cooldown > 0 ? `Reenviar em ${cooldown}s` : sending ? 'Enviando...' : 'Reenviar e-mail'}</Button>}
      </div>
    </AuthLayout>
  )
}
