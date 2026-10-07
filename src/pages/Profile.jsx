import React, {
  useEffect,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  LockKeyhole,
  Phone,
  Save,
  Store,
  UserRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  changePassword,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from '@/api/data'
import AddressFields from '@/components/AddressFields'
import AvatarUploader from '@/components/AvatarUploader'
import DocumentField from '@/components/DocumentField'
import PasswordInput from '@/components/PasswordInput'
import SellerFreightSettings from '@/components/SellerFreightSettings'
import {
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { formatarCPF } from '@/lib/validation/cpf'
import { formatarDocumento } from '@/lib/validation/cnpj'
import { onlyCepDigits } from '@/lib/viacep'

const BIO_MAX = 500

const EMPTY = {
  name: '',
  phone: '',
  cpf: '',
  cpf_cnpj: '',
  business_name: '',
  bio: '',
  entrega_propria: false,
  cep: '',
  numero: '',
  complemento: '',
  cidade: '',
  uf: '',
}

export default function Profile() {
  const {
    user,
    session,
    refreshUser,
  } = useAuth()

  const [form, setForm] = useState(EMPTY)
  const [cepValid, setCepValid] = useState(false)
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const isSeller = Boolean(user?.has_seller_profile)
  const hasPassword = user?.has_password !== false

  const set = (key, value) =>
    setForm(current => ({
      ...current,
      [key]: value,
    }))

  useEffect(() => {
    if (!user) return

    setForm({
      name: user.full_name || '',
      phone: user.phone || '',
      cpf: formatarCPF(user.cpf || ''),
      cpf_cnpj: formatarDocumento(user.cpf_cnpj || ''),
      business_name: user.business_name || '',
      bio: user.bio || '',
      entrega_propria: Boolean(user.entrega_propria),
      cep: user.cep || '',
      numero: user.numero || '',
      complemento: user.complemento || '',
      cidade: user.cidade || '',
      uf: user.uf || '',
    })

    setCepValid(
      Boolean(user.cep && user.cidade && user.uf)
    )
  }, [user])

  const save = async () => {
    const hasAnyAddress = Boolean(
      form.cep ||
      form.numero ||
      form.cidade ||
      form.uf
    )

    if (
      hasAnyAddress &&
      (
        onlyCepDigits(form.cep).length !== 8 ||
        !cepValid ||
        !form.numero.trim()
      )
    ) {
      return toast.error(
        'Confira o CEP e o número do endereço.'
      )
    }

    setSaving(true)

    try {
      await updateProfile({
        ...form,
        cpf: user?.cpf || '',
        cpf_cnpj: user?.cpf_cnpj || '',
      })
      await refreshUser()
      toast.success('Perfil atualizado.')
    } catch (error) {
      console.error('[QUÉX] Falha ao atualizar perfil:', error)
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async () => {
    if (hasPassword && !passwords.current) {
      return toast.error('Informe a senha atual.')
    }

    if (passwords.next.length < 6) {
      return toast.error(
        'A nova senha deve ter no mínimo 6 caracteres.'
      )
    }

    if (passwords.next !== passwords.confirm) {
      return toast.error('As senhas não coincidem.')
    }

    setSavingPassword(true)

    try {
      await changePassword(
        hasPassword ? passwords.current : null,
        passwords.next
      )

      setPasswords({
        current: '',
        next: '',
        confirm: '',
      })

      await refreshUser().catch(() => {})

      toast.success(
        hasPassword
          ? 'Senha alterada com sucesso.'
          : 'Senha definida com sucesso.'
      )
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const publicPath = user
    ? `/${isSeller ? 'sellers' : 'buyers'}/${user.id}`
    : '/'

  const card =
    'bg-white rounded-2xl border border-gray-100 p-6 space-y-5 mb-6'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold text-[#0D1273] md:text-3xl">
          Meu Perfil
        </h1>

        <Link
          to={publicPath}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#0D1273] hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Ver perfil público
        </Link>
      </div>

      {user?.verification_pending && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Não foi possível validar seu documento agora. Tentaremos novamente em breve.
        </div>
      )}

      {/* Informações básicas: foto, nome, bio e contato. */}
      <div className={card}>
        <AvatarUploader
          user={user}
          onUpload={async file => {
            await uploadAvatar(file, session?.user?.id)
            await refreshUser()
          }}
          onRemove={async () => {
            await removeAvatar()
            await refreshUser()
          }}
        />

        <div>
          <Label>E-mail</Label>
          <Input
            value={user?.email || ''}
            disabled
            className="mt-1.5 bg-gray-50"
          />
        </div>

        <div>
          <Label>
            {user?.name_immutable
              ? 'Nome verificado'
              : user?.legal_name
                ? 'Nome fantasia'
                : 'Nome'}
          </Label>

          <div className="relative mt-1.5">
            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              value={form.name}
              disabled={Boolean(user?.name_immutable)}
              onChange={event => set('name', event.target.value)}
            />
          </div>

          {user?.name_immutable && (
            <p className="mt-1 text-xs text-gray-400">
              Este nome está vinculado ao CPF e não pode ser alterado.
            </p>
          )}
        </div>

        {user?.legal_name && (
          <div>
            <Label>Razão social</Label>
            <Input
              className="mt-1.5 bg-gray-50"
              value={user.legal_name}
              disabled
            />
          </div>
        )}

        <div>
          <Label>Telefone</Label>
          <div className="relative mt-1.5">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              inputMode="tel"
              value={form.phone}
              onChange={event => set('phone', event.target.value)}
            />
          </div>
        </div>

        {isSeller ? (
          <>
            <DocumentField
              kind="doc"
              value={form.cpf_cnpj}
              onChange={() => {}}
              disabled
            />

            {!user?.legal_name && (
              <div>
                <Label>Nome do estabelecimento</Label>

                <div className="relative mt-1.5">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-10"
                    value={form.business_name}
                    onChange={event =>
                      set('business_name', event.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <DocumentField
            kind="cpf"
            value={form.cpf}
            onChange={() => {}}
            disabled
          />
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label>Biografia</Label>
            <span className="text-xs text-gray-400">
              {form.bio.length}/{BIO_MAX}
            </span>
          </div>

          <Textarea
            className="mt-1.5"
            rows={4}
            maxLength={BIO_MAX}
            value={form.bio}
            onChange={event => set('bio', event.target.value)}
            placeholder="Conte um pouco sobre você."
          />
        </div>
      </div>

      {/* BUG 5: entrega fica logo após as informações básicas. */}
      {isSeller && (
        <div className="mb-6">
          <SellerFreightSettings embedded />
        </div>
      )}

      {/* Endereço e demais configurações ficam abaixo da entrega. */}
      <div className={card}>
        <div>
          <h2 className="font-heading text-lg font-bold text-[#0D1273]">
            Endereço
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Usado para localização e cálculo de rota.
          </p>
        </div>

        <AddressFields
          value={{
            cep: form.cep,
            numero: form.numero,
            complemento: form.complemento,
            cidade: form.cidade,
            uf: form.uf,
          }}
          onChange={address =>
            setForm(current => ({
              ...current,
              ...address,
            }))
          }
          onValidityChange={setCepValid}
          disabled={saving}
        />

        {isSeller && (
          <label className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
            <span>
              <span className="block text-sm font-medium">
                Entrega própria
              </span>
              <span className="mt-1 block text-xs text-gray-400">
                Informação complementar do perfil da loja.
              </span>
            </span>

            <input
              type="checkbox"
              checked={form.entrega_propria}
              onChange={event =>
                set('entrega_propria', event.target.checked)
              }
              className="h-5 w-5 accent-[#0D1273]"
            />
          </label>
        )}

        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>

      <div className={card.replace(' mb-6', '')}>
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-[#0D1273]">
            <LockKeyhole className="h-4 w-4" />
            {hasPassword ? 'Alterar senha' : 'Definir uma senha'}
          </h2>
        </div>

        {hasPassword && (
          <div>
            <Label>Senha atual</Label>
            <PasswordInput
              className="mt-1.5"
              autoComplete="current-password"
              value={passwords.current}
              onChange={event =>
                setPasswords({
                  ...passwords,
                  current: event.target.value,
                })
              }
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nova senha</Label>
            <PasswordInput
              className="mt-1.5"
              autoComplete="new-password"
              value={passwords.next}
              onChange={event =>
                setPasswords({
                  ...passwords,
                  next: event.target.value,
                })
              }
            />
          </div>

          <div>
            <Label>Confirmar nova senha</Label>
            <PasswordInput
              className="mt-1.5"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={event =>
                setPasswords({
                  ...passwords,
                  confirm: event.target.value,
                })
              }
            />
          </div>
        </div>

        <Button
          onClick={savePassword}
          disabled={savingPassword}
        >
          {savingPassword
            ? 'Salvando...'
            : hasPassword
              ? 'Alterar senha'
              : 'Definir senha'}
        </Button>
      </div>
    </div>
  )
}
