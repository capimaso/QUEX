import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '@/components/AuthLayout'
import { Button, Input, Label } from '@/components/ui'
import { getSession, setSession, updatePassword } from '@/lib/supabaseRest'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(Boolean(getSession()))
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken) {
      setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
        token_type: 'bearer',
      })
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
      setReady(true)
      return
    }

    setReady(Boolean(getSession()))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!ready) {
      setError('O link de recuperação expirou ou não é válido. Solicite outro link.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      toast.success('Senha alterada com sucesso!')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      icon={LockKeyhole}
      title="Nova senha"
      subtitle="Defina uma nova senha para sua conta"
      footer={<Link to="/login" className="text-[#0D1273] font-medium hover:underline">Voltar para o login</Link>}
    >
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Confirmar nova senha</Label>
          <Input type="password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full h-12" disabled={loading || !ready}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}
