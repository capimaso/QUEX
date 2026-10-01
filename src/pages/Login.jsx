import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock, Loader2, AlertTriangle } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import GoogleButton, { OrDivider } from '@/components/GoogleButton'
import { Button, Input, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, needsProfile, login, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const from = location.state?.from?.pathname || '/'

  if (needsProfile) return <Navigate to="/complete-profile" replace />
  if (user) return <Navigate to={from} replace />

  const submit = async e => {
    e.preventDefault()
    setError('')
    setUnconfirmed(false)
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setUnconfirmed(err.code === 'email_not_confirmed')
      setError(err.message || 'E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout icon={LogIn} title="Bem-vindo de volta" subtitle="Entre na sua conta" footer={<><span>Não tem uma conta? </span><Link to="/register" className="text-[#0D1273] font-medium hover:underline">Criar conta</Link></>}>
      {!configured && <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />Configure as variáveis do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) e verifique o deploy.</div>}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
          {error}
          {unconfirmed && <> <Link to="/verify-email" state={{ email: email.trim().toLowerCase() }} className="font-medium underline">Reenviar e-mail de confirmação</Link></>}
        </div>
      )}
      <GoogleButton onError={setError} />
      <OrDivider />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>E-mail</Label>
          <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" /></div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Senha</Label><Link to="/forgot-password" className="text-xs text-[#0D1273] hover:underline">Esqueci minha senha</Link></div>
          <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" /></div>
        </div>
        <Button className="w-full h-12" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : 'Entrar'}</Button>
      </form>
    </AuthLayout>
  )
}
