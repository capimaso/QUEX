import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import { Button, Input, Label } from '@/components/ui'
import { apiRequest } from '@/api/client'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const clean = email.trim().toLowerCase()
    try {
      // Conta antiga ainda não migrada pro Supabase Auth? Migra antes, senão o e-mail não sai.
      await apiRequest('/api/auth/legacy', { method: 'POST', body: JSON.stringify({ action: 'reset', email: clean }) }).catch(() => {})
      const { error: err } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: `${window.location.origin}/reset-password` })
      if (err) throw err
      setSent(true)
    } catch (err) {
      setError(err.status === 429 || /rate limit/i.test(err.message || '') ? 'Muitos pedidos seguidos. Espera uns minutinhos.' : err.message || 'Não foi possível enviar o e-mail.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout icon={Mail} title="Recuperar senha" subtitle="Enviaremos um link para redefinição" footer={<Link to="/login" className="inline-flex items-center gap-1 text-[#0D1273] font-medium hover:underline"><ArrowLeft className="w-3 h-3" />Voltar para o login</Link>}>
      {sent ? (
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-green-100 text-green-700 flex items-center justify-center"><Send className="w-6 h-6" /></div>
          <h2 className="font-semibold text-[#0D1273]">Confira seu e-mail</h2>
          <p className="text-sm text-gray-500">Se {email} estiver cadastrado, o link de redefinição já está a caminho.</p>
        </div>
      ) : (
        <>
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" /></div>
            <Button className="w-full h-12" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link'}</Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
