import React, { useState } from 'react'
import {
  Navigate,
  useNavigate,
} from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Loader2,
  Phone,
  Store,
  User,
  UserCheck,
} from 'lucide-react'
import AddressFields from '@/components/AddressFields'
import AuthLayout from '@/components/AuthLayout'
import DocumentField from '@/components/DocumentField'
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

export default function CompleteProfile() {
  const navigate = useNavigate()
  const {
    user,
    needsProfile,
    authInfo,
    completeProfile,
    logout,
  } = useAuth()

  const [role, setRole] =
    useState('buyer')

  const [form, setForm] =
    useState({
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

  if (user) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  if (!needsProfile) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  const validate = () => {
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

      if (
        !form.business_name.trim()
      ) {
        return 'Informe o nome do estabelecimento ou da pessoa.'
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
      onlyCepDigits(form.cep)
        .length !== 8
    ) {
      return 'Informe um CEP válido com 8 dígitos.'
    }

    if (!cepValid) {
      return 'Aguarde a validação do CEP ou confira os números.'
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
    setLoading(true)

    try {
      await completeProfile({
        ...form,
        role,
      })

      toast.success(
        'Cadastro completo! Bem-vindo(a) ao QUÉX.'
      )

      navigate(
        '/',
        { replace: true }
      )
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível salvar.'
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

  const first =
    (authInfo?.name || '')
      .split(' ')[0]

  return (
    <AuthLayout
      icon={UserCheck}
      title={
        first
          ? `Quase lá, ${first}!`
          : 'Quase lá!'
      }
      subtitle="Faltam alguns dados pra concluir seu cadastro"
      footer={
        <button
          type="button"
          onClick={logout}
          className="font-medium text-[#0D1273] hover:underline"
        >
          Cancelar e sair
        </button>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            setRole('buyer')
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
            setRole('seller')
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
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4"
      >
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
              Salvando...
            </>
          ) : (
            'Concluir cadastro'
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}
