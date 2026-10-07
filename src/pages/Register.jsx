import React, { useState } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileWarning,
  Loader2,
  Mail,
  Phone,
  Store,
  User,
  UserPlus,
} from 'lucide-react'
import AuthLayout from '@/components/AuthLayout'
import AddressFields from '@/components/AddressFields'
import CpfClaimModal from '@/components/CpfClaimModal'
import DeliverySetupFields from '@/components/DeliverySetupFields'
import GoogleButton, { OrDivider } from '@/components/GoogleButton'
import PasswordInput from '@/components/PasswordInput'
import VerifiedDocumentField from '@/components/VerifiedDocumentField'
import {
  Button,
  Input,
  Label,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import {
  removerMascara,
  validarCPF,
} from '@/lib/validation/cpf'
import { validarCNPJ } from '@/lib/validation/cnpj'
import { onlyCepDigits } from '@/lib/viacep'

export default function Register() {
  const navigate = useNavigate()
  const { user, needsProfile, register } = useAuth()

  const [role, setRole] = useState('buyer')
  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
    email: '',
    cpf: '',
    cpf_cnpj: '',
    phone: '',
    business_name: '',
    entrega_disponivel: false,
    valor_por_km: '',
    cep: '',
    numero: '',
    complemento: '',
    cidade: '',
    uf: '',
  })

  const [documentState, setDocumentState] = useState(null)
  const [cepValid, setCepValid] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [claimAvailable, setClaimAvailable] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)

  const isSeller = role === 'seller'

  const set = (key, value) =>
    setForm(current => ({
      ...current,
      [key]: value,
    }))

  const setAddress = address =>
    setForm(current => ({
      ...current,
      ...address,
    }))

  const handleRole = nextRole => {
    setRole(nextRole)
    setDocumentState(null)
    setError('')
    setForm(current => ({
      ...current,
      cpf: '',
      cpf_cnpj: '',
      business_name: '',
      entrega_disponivel:
        nextRole === 'seller'
          ? current.entrega_disponivel
          : false,
      valor_por_km:
        nextRole === 'seller'
          ? current.valor_por_km
          : '',
    }))
  }

  const handleDocumentState = state => {
    setDocumentState(state)

    if (
      state?.kind === 'cnpj' &&
      state?.trade_name
    ) {
      setForm(current => ({
        ...current,
        business_name:
          current.business_name ||
          state.trade_name,
      }))
    }
  }

  if (needsProfile) {
    return <Navigate to="/complete-profile" replace />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const currentCpf = removerMascara(
    isSeller ? form.cpf_cnpj : form.cpf
  )

  const validate = () => {
    if (!form.email.trim()) {
      return 'Informe seu e-mail.'
    }

    if (form.password.length < 6) {
      return 'A senha deve ter no mínimo 6 caracteres.'
    }

    if (form.password !== form.confirmPassword) {
      return 'As senhas não coincidem.'
    }

    if (isSeller) {
      const document = removerMascara(form.cpf_cnpj)

      if (
        document.length === 11 &&
        !validarCPF(document)
      ) {
        return 'CPF inválido. Confere os números.'
      }

      if (
        document.length === 14 &&
        !validarCNPJ(document)
      ) {
        return 'CNPJ inválido. Confere os números.'
      }

      if (![11, 14].includes(document.length)) {
        return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'
      }
    } else if (!validarCPF(form.cpf)) {
      return 'CPF inválido. Confere os números.'
    }

    if (!documentState) {
      return 'Aguarde a validação do CPF/CNPJ.'
    }

    if (documentState.error) {
      return (
        documentState.message ||
        'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'
      )
    }

    if (
      documentState.kind === 'cnpj' &&
      !documentState.pending &&
      !documentState.legal_name
    ) {
      return 'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'
    }

    if (
      documentState.kind === 'cpf' &&
      !documentState.pending &&
      !documentState.official_name
    ) {
      return 'CPF/CNPJ inválido ou não encontrado na base da Receita Federal.'
    }

    if (
      isSeller &&
      documentState.kind === 'cnpj' &&
      !form.business_name.trim()
    ) {
      return 'Informe o nome fantasia.'
    }

    if (
      isSeller &&
      form.entrega_disponivel &&
      (
        !Number.isFinite(Number(form.valor_por_km)) ||
        Number(form.valor_por_km) <= 0
      )
    ) {
      return 'Informe um valor por Km maior que zero.'
    }

    if (removerMascara(form.phone).length < 10) {
      return 'Informe um telefone válido com DDD.'
    }

    if (onlyCepDigits(form.cep).length !== 8) {
      return 'Informe um CEP válido com 8 dígitos.'
    }

    if (!cepValid) {
      return 'Aguarde a validação do CEP ou confira os números informados.'
    }

    if (!form.numero.trim()) {
      return 'Informe o número do endereço.'
    }

    if (!form.cidade || !form.uf) {
      return 'Não foi possível confirmar cidade e UF pelo CEP.'
    }

    return ''
  }

  const submit = async event => {
    event.preventDefault()

    const problem = validate()

    if (problem) {
      return setError(problem)
    }

    setError('')
    setClaimAvailable(false)
    setLoading(true)

    try {
      const email = form.email.trim().toLowerCase()

      const result = await register({
        ...form,
        email,
        role,
      })

      if (result.verification_warning) {
        toast(result.verification_warning, {
          icon: '⚠️',
          duration: 7000,
        })
      }

      if (result.pending_verification) {
        navigate('/verify-email', {
          replace: true,
          state: { email },
        })
      } else {
        toast.success('Conta criada! Já pode entrar.')
        navigate('/login', { replace: true })
      }
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível concluir o cadastro.'
      )

      setClaimAvailable(
        err.code === 'document_in_use' &&
        err.details?.document_kind === 'cpf'
      )
    } finally {
      setLoading(false)
    }
  }

  const roleBtn = active =>
    `rounded-xl py-3 text-sm font-medium border transition-colors duration-200 ${
      active
        ? 'bg-[#0D1273] text-white border-[#0D1273]'
        : 'bg-white text-gray-600 border-gray-200'
    }`

  return (
    <>
      <AuthLayout
        icon={UserPlus}
        title="Crie sua conta"
        subtitle="Escolha o tipo de cadastro"
        footer={
          <>
            <span>Já tem uma conta? </span>
            <Link
              to="/login"
              className="font-medium text-[#0D1273] hover:underline"
            >
              Entrar
            </Link>
          </>
        }
      >
        <div className="mb-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleRole('buyer')}
            className={roleBtn(!isSeller)}
          >
            <User className="mr-2 inline h-4 w-4" />
            Comprador
          </button>

          <button
            type="button"
            onClick={() => handleRole('seller')}
            className={roleBtn(isSeller)}
          >
            <Store className="mr-2 inline h-4 w-4" />
            Vendedor
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            <p>{error}</p>

            {claimAvailable && (
              <button
                type="button"
                onClick={() => setClaimOpen(true)}
                className="mt-3 inline-flex items-center gap-2 font-semibold underline"
              >
                <FileWarning className="h-4 w-4" />
                Esse CPF já possui uma conta. Deseja reivindicá-la?
              </button>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-10"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={event => set('email', event.target.value)}
                placeholder="voce@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Senha</Label>
              <PasswordInput
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={event => set('password', event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <PasswordInput
                required
                minLength={6}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={event =>
                  set('confirmPassword', event.target.value)
                }
              />
            </div>
          </div>

          {isSeller ? (
            <VerifiedDocumentField
              kind="doc"
              value={form.cpf_cnpj}
              onChange={value => set('cpf_cnpj', value)}
              onVerificationChange={handleDocumentState}
              disabled={loading}
            />
          ) : (
            <VerifiedDocumentField
              kind="cpf"
              value={form.cpf}
              onChange={value => set('cpf', value)}
              onVerificationChange={handleDocumentState}
              disabled={loading}
            />
          )}

          {isSeller &&
            documentState?.kind === 'cnpj' && (
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-10"
                    required
                    value={form.business_name}
                    onChange={event =>
                      set('business_name', event.target.value)
                    }
                    placeholder="Nome usado no QUÉX"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  A razão social vem da Receita Federal; somente o nome fantasia pode ser editado.
                </p>
              </div>
            )}

          {isSeller && (
            <DeliverySetupFields
              enabled={form.entrega_disponivel}
              rate={form.valor_por_km}
              onEnabledChange={value =>
                set('entrega_disponivel', value)
              }
              onRateChange={value =>
                set('valor_por_km', value)
              }
              disabled={loading}
            />
          )}

          <div className="space-y-2">
            <Label>Número de telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-10"
                required
                inputMode="tel"
                value={form.phone}
                onChange={event => set('phone', event.target.value)}
                placeholder="(48) 99999-9999"
              />
            </div>
          </div>

          <AddressFields
            value={{
              cep: form.cep,
              numero: form.numero,
              complemento: form.complemento,
              cidade: form.cidade,
              uf: form.uf,
            }}
            onChange={setAddress}
            onValidityChange={setCepValid}
            disabled={loading}
          />

          <Button className="h-12 w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta'
            )}
          </Button>
        </form>

        <OrDivider />

        <GoogleButton
          label="Cadastrar com Google"
          onError={setError}
        />
      </AuthLayout>

      <CpfClaimModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        cpf={currentCpf}
        initialEmail={form.email}
        initialPhone={form.phone}
      />
    </>
  )
}
