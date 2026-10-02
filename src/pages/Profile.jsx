import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, UserRound, Store, Phone, MapPin, LockKeyhole, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateProfile, changePassword, uploadAvatar, removeAvatar } from '@/api/data'
import AvatarUploader from '@/components/AvatarUploader'
import DocumentField from '@/components/DocumentField'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatarCPF } from '@/lib/validation/cpf'
import { formatarDocumento } from '@/lib/validation/cnpj'

const BIO_MAX = 500
const EMPTY = { name: '', phone: '', cpf: '', cpf_cnpj: '', business_name: '', address: '', localizacao: '', bio: '', entrega_propria: false }

export default function Profile() {
  const { user, session, refreshUser } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const isSeller = user?.role === 'seller'
  const hasPassword = user?.has_password !== false // quem entrou só com Google ainda não tem senha
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    if (!user) return
    setForm({
      name: user.full_name || '', phone: user.phone || '',
      cpf: formatarCPF(user.cpf || ''), cpf_cnpj: formatarDocumento(user.cpf_cnpj || ''),
      business_name: user.business_name || '', address: user.address || '',
      localizacao: user.localizacao || '', bio: user.bio || '',
      entrega_propria: Boolean(user.entrega_propria),
    })
  }, [user])

  const save = async () => {
    setSaving(true)
    try { await updateProfile(form); await refreshUser(); toast.success('Perfil atualizado.') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const savePassword = async () => {
    if (hasPassword && !passwords.current) return toast.error('Informe a senha atual.')
    if (passwords.next.length < 6) return toast.error('A nova senha deve ter no mínimo 6 caracteres.')
    if (passwords.next !== passwords.confirm) return toast.error('As senhas não coincidem.')
    setSavingPassword(true)
    try {
      await changePassword(hasPassword ? passwords.current : null, passwords.next)
      setPasswords({ current: '', next: '', confirm: '' })
      await refreshUser().catch(() => {})
      toast.success(hasPassword ? 'Senha alterada com sucesso.' : 'Senha definida! Agora você também pode entrar com e-mail e senha.')
    } catch (e) { toast.error(e.message) }
    finally { setSavingPassword(false) }
  }

  const publicPath = user ? `/${isSeller ? 'sellers' : 'buyers'}/${user.id}` : '/'
  const card = 'bg-white rounded-2xl border border-gray-100 p-6 space-y-5 mb-6'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8 gap-3">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-[#0D1273]">Meu Perfil</h1>
        <Link to={publicPath} className="inline-flex items-center gap-1 text-sm text-[#0D1273] font-medium hover:underline"><ExternalLink className="w-4 h-4" />Ver perfil público</Link>
      </div>

      <div className={card}>
        <AvatarUploader user={user} onUpload={async file => { await uploadAvatar(file, session?.user?.id); await refreshUser() }} onRemove={async () => { await removeAvatar(); await refreshUser() }} />
      </div>

      <div className={card}>
        <div><Label>E-mail</Label><Input value={user?.email || ''} disabled className="mt-1.5 bg-gray-50" /></div>
        <div><Label>{isSeller ? 'Nome do responsável' : 'Nome'}</Label><div className="relative mt-1.5"><UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" value={form.name} onChange={e => set('name', e.target.value)} /></div></div>
        <div><Label>Telefone</Label><div className="relative mt-1.5"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div></div>
        {isSeller ? (
          <>
            <DocumentField kind="doc" value={form.cpf_cnpj} onChange={v => set('cpf_cnpj', v)} />
            <div><Label>Nome do estabelecimento</Label><div className="relative mt-1.5"><Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" value={form.business_name} onChange={e => set('business_name', e.target.value)} /></div></div>
          </>
        ) : <DocumentField kind="cpf" value={form.cpf} onChange={v => set('cpf', v)} />}
        <div><Label>Localização</Label><div className="relative mt-1.5"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Cidade, UF" maxLength={120} /></div></div>
        <div>
          <div className="flex items-center justify-between"><Label>Biografia</Label><span className="text-xs text-gray-400">{form.bio.length}/{BIO_MAX}</span></div>
          <Textarea className="mt-1.5" rows={4} maxLength={BIO_MAX} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder={isSeller ? 'Conte sua história, como pesca, o que você vende...' : 'Conte um pouco sobre você.'} />
          <p className="text-xs text-gray-400 mt-1">Aparece no seu perfil público.</p>
        </div>
        {isSeller && (
          <label className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
            <span><span className="block text-sm font-medium">Entrega própria</span><span className="block text-xs text-gray-400 mt-1">Marque caso o vendedor faça a própria entrega.</span></span>
            <input type="checkbox" checked={form.entrega_propria} onChange={e => set('entrega_propria', e.target.checked)} className="w-5 h-5 accent-[#0D1273]" />
          </label>
        )}
        <div><Label>Endereço padrão</Label><Input className="mt-1.5" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro, cidade - UF" /></div>
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
      </div>

      <div className={card.replace(' mb-6', '')}>
        <div>
          <h2 className="font-semibold text-[#0D1273] flex items-center gap-2"><LockKeyhole className="w-4 h-4" />{hasPassword ? 'Alterar senha' : 'Definir uma senha'}</h2>
          {!hasPassword && <p className="text-xs text-gray-400 mt-1">Você entrou com o Google. Se quiser, defina uma senha pra também entrar com e-mail e senha.</p>}
        </div>
        {hasPassword && <div><Label>Senha atual</Label><Input className="mt-1.5" type="password" autoComplete="current-password" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} /></div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nova senha</Label><Input className="mt-1.5" type="password" autoComplete="new-password" value={passwords.next} onChange={e => setPasswords({ ...passwords, next: e.target.value })} /></div>
          <div><Label>Confirmar nova senha</Label><Input className="mt-1.5" type="password" autoComplete="new-password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} /></div>
        </div>
        <Button onClick={savePassword} disabled={savingPassword}>{savingPassword ? 'Salvando...' : hasPassword ? 'Alterar senha' : 'Definir senha'}</Button>
      </div>
    </div>
  )
}
