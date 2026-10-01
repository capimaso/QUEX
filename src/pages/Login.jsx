import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn, Mail, Lock, Loader2, AlertTriangle } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import { Button, Input, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate(); const location = useLocation(); const { login, configured } = useAuth()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async (e) => { e.preventDefault(); setError(''); if(!configured) return setError('Supabase não configurado. Veja o README e defina as variáveis de ambiente.'); setLoading(true); try { await login(email.trim(), password); toast.success('Bem-vindo de volta!'); navigate(location.state?.from?.pathname || '/', { replace: true }) } catch (err) { setError(err.message || 'E-mail ou senha inválidos.') } finally { setLoading(false) } }
  return <AuthLayout icon={LogIn} title="Bem-vindo de volta" subtitle="Entre na sua conta" footer={<><span>Não tem uma conta? </span><Link to="/register" className="text-[#0D1273] font-medium hover:underline">Criar conta</Link></>}>
    {!configured && <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />Configure o Supabase para ativar o login.</div>}
    {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label>E-mail</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" /></div></div>
      <div className="space-y-2"><Label>Senha</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" /></div></div>
      <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-[#0D1273] hover:underline">Esqueci minha senha</Link></div>
      <Button type="submit" className="w-full h-12" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : 'Entrar'}</Button>
    </form>
  </AuthLayout>
}
