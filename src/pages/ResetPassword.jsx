import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout from '@/components/AuthLayout'
import PasswordInput from '@/components/PasswordInput'
import { Button, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { session, refreshUser } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ready = Boolean(session)

  const submit = async event => {
    event.preventDefault()
    setError('')

    if (!ready) {
      return setError(
        'O link de recuperação expirou ou não é válido. Peça outro link.'
      )
    }

    if (password.length < 6) {
      return setError('A senha deve ter no mínimo 6 caracteres.')
    }

    if (password !== confirm) {
      return setError('As senhas não coincidem.')
    }

    setLoading(true)

    try {
      const { error: err } = await supabase.auth.updateUser({
        password,
      })
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
    <AuthLayout
      icon={LockKeyhole}
      title="Nova senha"
      subtitle="Defina uma nova senha para sua conta"
      footer={
        <Link
          to="/login"
          className="font-medium text-[#0D1273] hover:underline"
        >
          Voltar para o login
        </Link>
      }
    >
      {!ready && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          Link inválido ou expirado.{' '}
          <Link
            to="/forgot-password"
            className="font-medium underline"
          >
            Pedir outro link
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nova senha</Label>
          <PasswordInput
            minLength={6}
            required
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Confirmar nova senha</Label>
          <PasswordInput
            minLength={6}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={event => setConfirm(event.target.value)}
          />
        </div>

        <Button className="h-12 w-full" disabled={loading || !ready}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthLayout>
  )
}
