import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserCheck, User, Store, Phone, MapPin, Loader2 } from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import DocumentField from '@/components/DocumentField'
import { Button, Input, Label } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { removerMascara, validarCPF } from '@/lib/validation/cpf'
import { validarCNPJ } from '@/lib/validation/cnpj'

// 2ª etapa depois do primeiro login com Google: o Google não manda CPF, telefone etc.
export default function CompleteProfile() {
  const navigate = useNavigate()
  const { user, needsProfile, authInfo, completeProfile, logout } = useAuth()
  const [role, setRole] = useState('buyer')
  const [form, setForm] = useState({ cpf: '', cpf_cnpj: '', phone: '', localizacao: '', business_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isSeller = role === 'seller'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (user) return <Navigate to="/" replace />
  if (!needsProfile) return <Navigate to="/login" replace />

  const validate = () => {
    if (isSeller) {
      const d = removerMascara(form.cpf_cnpj)
      if (d.length === 11 && !validarCPF(d)) return 'CPF inválido. Confere os números.'
      if (d.length === 14 && !validarCNPJ(d)) return 'CNPJ inválido. Confere os números.'
      if (![11, 14].includes(d.length)) return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'
      if (!form.business_name.trim()) return 'Informe o nome do estabelecimento ou da pessoa.'
    } else if (!validarCPF(form.cpf)) return 'CPF inválido. Confere os números.'
    if (removerMascara(form.phone).length < 10) return 'Informe um telefone válido com DDD.'
    if (!form.localizacao.trim()) return 'Informe sua cidade/UF.'
    return ''
  }

  const submit = async e => {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setError('')
    setLoading(true)
    try {
      await completeProfile({ ...form, role })
      toast.success('Cadastro completo! Bem-vindo(a) ao QUÉX.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.')
    } finally {
      setLoading(false)
    }
  }

  const roleBtn = active => `rounded-xl py-3 text-sm font-medium border transition-colors duration-200 ${active ? 'bg-[#0D1273] text-white border-[#0D1273]' : 'bg-white text-gray-600 border-gray-200'}`
  const first = (authInfo?.name || '').split(' ')[0]

  return (
    <AuthLayout icon={UserCheck} title={first ? `Quase lá, ${first}!` : 'Quase lá!'} subtitle="Faltam alguns dados pra concluir seu cadastro" footer={<button type="button" onClick={logout} className="text-[#0D1273] font-medium hover:underline">Cancelar e sair</button>}>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button type="button" onClick={() => setRole('buyer')} className={roleBtn(!isSeller)}><User className="w-4 h-4 inline mr-2" />Comprador</button>
        <button type="button" onClick={() => setRole('seller')} className={roleBtn(isSeller)}><Store className="w-4 h-4 inline mr-2" />Vendedor</button>
      </div>
      {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        {isSeller
          ? <DocumentField kind="doc" value={form.cpf_cnpj} onChange={v => set('cpf_cnpj', v)} />
          : <DocumentField kind="cpf" value={form.cpf} onChange={v => set('cpf', v)} />}
        {isSeller && (
          <div className="space-y-2">
            <Label>Nome do estabelecimento ou da pessoa</Label>
            <div className="relative"><Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" required value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Pescados do João" /></div>
          </div>
        )}
        <div className="space-y-2">
          <Label>Número de telefone</Label>
          <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" required inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(48) 99999-9999" /></div>
        </div>
        <div className="space-y-2">
          <Label>Localização</Label>
          <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" required value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Palhoça, SC" /></div>
        </div>
        <Button className="w-full h-12" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Concluir cadastro'}</Button>
      </form>
    </AuthLayout>
  )
}
