import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '@/components/AuthLayout'
import { Button, Input, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

// O link do e-mail já cria uma sessão de recuperação; aqui só trocamos a senha.
export default function ResetPassword() {
  const navigate = useNavigate()
  const { session, refreshUser } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ready = Boolean(session)

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (!ready) return setError('O link de recuperação expirou ou não é válido. Peça outro link.')
    if (password.length < 6) return setError('A senha deve ter no mínimo 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      await refreshUser().catch(() => {})
      toast.success('Senha alterada com sucesso!')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Não foi possível alterar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout icon={LockKeyhole} title="Nova senha" subtitle="Defina uma nova senha para sua conta" footer={<Link to="/login" className="text-[#0D1273] font-medium hover:underline">Voltar para o login</Link>}>
      {!ready && <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm">Link inválido ou expirado. <Link to="/forgot-password" className="underline font-medium">Pedir outro link</Link></div>}
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>Nova senha</Label><Input type="password" minLength={6} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label>Confirmar nova senha</Label><Input type="password" minLength={6} required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
        <Button className="w-full h-12" disabled={loading || !ready}>{loading ? 'Salvando...' : 'Salvar nova senha'}</Button>
      </form>
    </AuthLayout>
  )
}
