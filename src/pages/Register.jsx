import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Mail, User, Store, Phone, Loader2 } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import DocumentField from '@/components/DocumentField'
import GoogleButton, { OrDivider } from '@/components/GoogleButton'
import { Button, Input, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { removerMascara, validarCPF } from '@/lib/validation/cpf'
import { validarCNPJ } from '@/lib/validation/cnpj'

export default function Register() {
  const navigate = useNavigate()
  const { user, needsProfile, register } = useAuth()
  const [role, setRole] = useState('buyer')
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '', email: '', cpf: '', cpf_cnpj: '', phone: '', business_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isSeller = role === 'seller'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (needsProfile) return <Navigate to="/complete-profile" replace />
  if (user) return <Navigate to="/" replace />

  const validate = () => {
    if (!form.name.trim()) return 'Informe seu nome.'
    if (!form.email.trim()) return 'Informe seu e-mail.'
    if (form.password.length < 6) return 'A senha deve ter no mínimo 6 caracteres.'
    if (form.password !== form.confirmPassword) return 'As senhas não coincidem.'
    if (isSeller) {
      const d = removerMascara(form.cpf_cnpj)
      if (d.length === 11 && !validarCPF(d)) return 'CPF inválido. Confere os números.'
      if (d.length === 14 && !validarCNPJ(d)) return 'CNPJ inválido. Confere os números.'
      if (![11, 14].includes(d.length)) return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'
    } else if (!validarCPF(form.cpf)) return 'CPF inválido. Confere os números.'
    if (removerMascara(form.phone).length < 10) return 'Informe um telefone válido com DDD.'
    if (isSeller && !form.business_name.trim()) return 'Informe o nome do estabelecimento ou da pessoa.'
    return ''
  }

  const submit = async e => {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setError('')
    setLoading(true)
    try {
      const email = form.email.trim().toLowerCase()
      const result = await register({ ...form, email, role })
      if (result.pending_verification) navigate('/verify-email', { replace: true, state: { email } })
      else { toast.success('Conta criada! Já pode entrar.'); navigate('/login', { replace: true }) }
    } catch (err) {
      setError(err.message || 'Não foi possível concluir o cadastro.')
    } finally {
      setLoading(false)
    }
  }

  const roleBtn = active => `rounded-xl py-3 text-sm font-medium border transition-colors duration-200 ${active ? 'bg-[#0D1273] text-white border-[#0D1273]' : 'bg-white text-gray-600 border-gray-200'}`

  return (
    <AuthLayout icon={UserPlus} title="Crie sua conta" subtitle="Escolha o tipo de cadastro" footer={<><span>Já tem uma conta? </span><Link to="/login" className="text-[#0D1273] font-medium hover:underline">Entrar</Link></>}>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button type="button" onClick={() => setRole('buyer')} className={roleBtn(!isSeller)}><User className="w-4 h-4 inline mr-2" />Comprador</button>
        <button type="button" onClick={() => setRole('seller')} className={roleBtn(isSeller)}><Store className="w-4 h-4 inline mr-2" />Vendedor</button>
      </div>
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>{isSeller ? 'Nome do vendedor' : 'Nome completo'}</Label>
          <Input required value={form.name} onChange={e => set('name', e.target.value)} placeholder={isSeller ? 'Nome do pescador ou responsável' : 'Seu nome completo'} />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" type="email" required autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="voce@exemplo.com" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Senha</Label><Input type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} /></div>
          <div className="space-y-2"><Label>Confirmar senha</Label><Input type="password" required minLength={6} autoComplete="new-password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} /></div>
        </div>
        {isSeller
          ? <DocumentField kind="doc" value={form.cpf_cnpj} onChange={v => set('cpf_cnpj', v)} />
          : <DocumentField kind="cpf" value={form.cpf} onChange={v => set('cpf', v)} />}
        <div className="space-y-2">
          <Label>Número de telefone</Label>
          <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" required inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(48) 99999-9999" /></div>
        </div>
        {isSeller && (
          <div className="space-y-2">
            <Label>Nome do estabelecimento ou da pessoa</Label>
            <div className="relative"><Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" required value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Pescados do João" /></div>
          </div>
        )}
        <Button className="w-full h-12" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando conta...</> : 'Criar conta'}</Button>
      </form>
      <OrDivider />
      <GoogleButton label="Cadastrar com Google" onError={setError} />
    </AuthLayout>
  )
}
