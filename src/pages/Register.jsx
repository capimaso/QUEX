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
import DocumentField from '@/components/DocumentField'
import GoogleButton, {
  OrDivider,
} from '@/components/GoogleButton'
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
  const {
    user,
    needsProfile,
    register,
  } = useAuth()

  const [role, setRole] =
    useState('buyer')

  const [form, setForm] =
    useState({
      name: '',
      password: '',
      confirmPassword: '',
      email: '',
      cpf: '',
      cpf_cnpj: '',
      phone: '',
      business_name: '',
      cep: '',
      numero: '',
      complemento: '',
      cidade: '',
      uf: '',
    })

  const [cepValid, setCepValid] =
    useState(false)
  const [error, setError] =
    useState('')
  const [loading, setLoading] =
    useState(false)
  const [
    claimAvailable,
    setClaimAvailable,
  ] = useState(false)
  const [claimOpen, setClaimOpen] =
    useState(false)

  const isSeller =
    role === 'seller'

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

  if (needsProfile) {
    return (
      <Navigate
        to="/complete-profile"
        replace
      />
    )
  }

  if (user) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  const currentCpf =
    removerMascara(
      isSeller
        ? form.cpf_cnpj
        : form.cpf
    )

  const validate = () => {
    if (!form.name.trim()) {
      return 'Informe seu nome.'
    }

    if (!form.email.trim()) {
      return 'Informe seu e-mail.'
    }

    if (form.password.length < 6) {
      return 'A senha deve ter no mínimo 6 caracteres.'
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      return 'As senhas não coincidem.'
    }

    if (isSeller) {
      const document =
        removerMascara(
          form.cpf_cnpj
        )

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

      if (
        ![11, 14].includes(
          document.length
        )
      ) {
        return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'
      }
    } else if (
      !validarCPF(form.cpf)
    ) {
      return 'CPF inválido. Confere os números.'
    }

    if (
      removerMascara(
        form.phone
      ).length < 10
    ) {
      return 'Informe um telefone válido com DDD.'
    }

    if (
      isSeller &&
      !form.business_name.trim()
    ) {
      return 'Informe o nome do estabelecimento ou da pessoa.'
    }

    if (
      onlyCepDigits(form.cep)
        .length !== 8
    ) {
      return 'Informe um CEP válido com 8 dígitos.'
    }

    if (!cepValid) {
      return 'Aguarde a validação do CEP ou confira os números informados.'
    }

    if (
      !form.numero.trim()
    ) {
      return 'Informe o número do endereço.'
    }

    if (
      !form.cidade ||
      !form.uf
    ) {
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
      const email =
        form.email
          .trim()
          .toLowerCase()

      const result =
        await register({
          ...form,
          email,
          role,
        })

      if (
        result.pending_verification
      ) {
        navigate(
          '/verify-email',
          {
            replace: true,
            state: { email },
          }
        )
      } else {
        toast.success(
          'Conta criada! Já pode entrar.'
        )
        navigate(
          '/login',
          { replace: true }
        )
      }
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível concluir o cadastro.'
      )

      setClaimAvailable(
        err.code ===
          'document_in_use' &&
          err.details
            ?.document_kind ===
            'cpf'
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

  const changeRole = nextRole => {
    setRole(nextRole)
    setError('')
    setClaimAvailable(false)
  }

  return (
    <>
      <AuthLayout
        icon={UserPlus}
        title="Crie sua conta"
        subtitle="Escolha o tipo de cadastro"
        footer={
          <>
            <span>
              Já tem uma conta?{' '}
            </span>
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
            onClick={() =>
              changeRole('buyer')
            }
            className={roleBtn(
              !isSeller
            )}
          >
            <User className="mr-2 inline h-4 w-4" />
            Comprador
          </button>

          <button
            type="button"
            onClick={() =>
              changeRole('seller')
            }
            className={roleBtn(
              isSeller
            )}
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
                onClick={() =>
                  setClaimOpen(true)
                }
                className="mt-3 inline-flex items-center gap-2 font-semibold underline"
              >
                <FileWarning className="h-4 w-4" />
                Esse CPF já possui uma conta. Deseja reivindicá-la?
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={submit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>
              {isSeller
                ? 'Nome do vendedor'
                : 'Nome completo'}
            </Label>

            <Input
              required
              value={form.name}
              onChange={event =>
                set(
                  'name',
                  event.target.value
                )
              }
              placeholder={
                isSeller
                  ? 'Nome do pescador ou responsável'
                  : 'Seu nome completo'
              }
            />
          </div>

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
                onChange={event =>
                  set(
                    'email',
                    event.target.value
                  )
                }
                placeholder="voce@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={event =>
                  set(
                    'password',
                    event.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Confirmar senha
              </Label>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={
                  form.confirmPassword
                }
                onChange={event =>
                  set(
                    'confirmPassword',
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          {isSeller ? (
            <DocumentField
              kind="doc"
              value={form.cpf_cnpj}
              onChange={value =>
                set(
                  'cpf_cnpj',
                  value
                )
              }
            />
          ) : (
            <DocumentField
              kind="cpf"
              value={form.cpf}
              onChange={value =>
                set('cpf', value)
              }
            />
          )}

          <div className="space-y-2">
            <Label>
              Número de telefone
            </Label>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <Input
                className="pl-10"
                required
                inputMode="tel"
                value={form.phone}
                onChange={event =>
                  set(
                    'phone',
                    event.target.value
                  )
                }
                placeholder="(48) 99999-9999"
              />
            </div>
          </div>

          {isSeller && (
            <div className="space-y-2">
              <Label>
                Nome do estabelecimento ou da pessoa
              </Label>

              <div className="relative">
                <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <Input
                  className="pl-10"
                  required
                  value={
                    form.business_name
                  }
                  onChange={event =>
                    set(
                      'business_name',
                      event.target.value
                    )
                  }
                  placeholder="Pescados do João"
                />
              </div>
            </div>
          )}

          <AddressFields
            value={{
              cep: form.cep,
              numero: form.numero,
              complemento:
                form.complemento,
              cidade: form.cidade,
              uf: form.uf,
            }}
            onChange={setAddress}
            onValidityChange={
              setCepValid
            }
            disabled={loading}
          />

          <Button
            className="h-12 w-full"
            disabled={loading}
          >
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
        onClose={() =>
          setClaimOpen(false)
        }
        cpf={currentCpf}
        initialEmail={form.email}
        initialPhone={form.phone}
      />
    </>
  )
}
