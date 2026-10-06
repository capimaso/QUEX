import React, {
  useEffect,
  useState,
} from 'react'
import {
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  ArrowLeft,
  Percent,
  Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getProduct,
  listSpecies,
  removeUploadedPhotos,
  saveProduct,
  uploadProductPhotos,
} from '@/api/data'
import PhotoUploader from '@/components/PhotoUploader'
import SpeciesCombobox from '@/components/SpeciesCombobox'
import {
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const EMPTY = {
  name: '',
  price: '',
  description: '',
  quantity: '',
  species_id: '',
  unit: 'kg',
  active: true,
  has_bones: false,
  water_type: 'doce',
  promotion_enabled: false,
  promotional_price: '',
  promotion_expires_at: '',
}

function toLocalDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  const pad = number =>
    String(number).padStart(2, '0')

  return [
    date.getFullYear(),
    '-',
    pad(
      date.getMonth() + 1
    ),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

function minDateTime() {
  return toLocalDateTimeInput(
    new Date(
      Date.now() + 60_000
    )
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, session } =
    useAuth()

  const isNew =
    id === 'new'

  const [form, setForm] =
    useState(EMPTY)

  const [photos, setPhotos] =
    useState([])

  const [
    legacySpecies,
    setLegacySpecies,
  ] = useState('')

  const [species, setSpecies] =
    useState([])

  const [
    speciesLoading,
    setSpeciesLoading,
  ] = useState(true)

  const [
    speciesError,
    setSpeciesError,
  ] = useState('')

  const [saving, setSaving] =
    useState(false)

  const set = (key, value) =>
    setForm(current => ({
      ...current,
      [key]: value,
    }))

  useEffect(() => {
    listSpecies()
      .then(setSpecies)
      .catch(() =>
        setSpeciesError(
          'Não foi possível carregar a lista de espécies.'
        )
      )
      .finally(() =>
        setSpeciesLoading(false)
      )
  }, [])

  useEffect(() => {
    if (isNew) return

    getProduct(id, true)
      .then(product => {
        if (!product) {
          throw new Error(
            'Produto não encontrado.'
          )
        }

        setForm({
          name:
            product.name,
          price:
            String(
              product.price
            ),
          description:
            product.description ||
            '',
          quantity:
            String(
              product.quantity
            ),
          species_id:
            product.species_id ??
            '',
          unit:
            product.unit || 'kg',
          active:
            product.active,
          has_bones:
            product.has_bones,
          water_type:
            product.water_type ||
            'doce',
          promotion_enabled:
            Boolean(
              product.promotion_active
            ),
          promotional_price:
            product.promotion_active
              ? String(
                  product.promotional_price
                )
              : '',
          promotion_expires_at:
            product.promotion_active
              ? toLocalDateTimeInput(
                  product.promotion_expires_at
                )
              : '',
        })

        setLegacySpecies(
          product.species_id
            ? ''
            : product.species || ''
        )

        setPhotos(
          (product.photos || []).map(
            (photo, index) => ({
              key:
                `r${index}-${photo.ref}`,
              ref: photo.ref,
              url: photo.url,
            })
          )
        )
      })
      .catch(error => {
        toast.error(
          error.message
        )
        navigate(
          '/seller/dashboard'
        )
      })
  }, [
    id,
    isNew,
    navigate,
  ])

  if (
    user?.role !==
    'seller'
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    )
  }

  const validate = () => {
    if (!form.name.trim()) {
      return 'Nome obrigatório.'
    }

    if (!form.species_id) {
      return 'Escolha uma espécie da lista.'
    }

    const price =
      Number(form.price)

    if (!(price > 0)) {
      return 'O preço deve ser maior que zero.'
    }

    if (
      !Number.isInteger(
        Number(
          form.quantity
        )
      ) ||
      Number(
        form.quantity
      ) < 0
    ) {
      return 'A quantidade deve ser um número inteiro não negativo.'
    }

    if (
      form.promotion_enabled
    ) {
      const promotional =
        Number(
          form.promotional_price
        )

      if (
        !Number.isFinite(
          promotional
        ) ||
        promotional <= 0
      ) {
        return 'Informe um preço promocional maior que zero.'
      }

      if (
        promotional >= price
      ) {
        return 'O preço promocional deve ser menor que o preço original.'
      }

      if (
        !form.promotion_expires_at
      ) {
        return 'Informe quando a promoção termina.'
      }

      const expiry =
        new Date(
          form.promotion_expires_at
        )

      if (
        Number.isNaN(
          expiry.getTime()
        ) ||
        expiry.getTime() <=
          Date.now()
      ) {
        return 'A promoção precisa terminar em uma data futura.'
      }
    }

    return ''
  }

  const save = async () => {
    const problem =
      validate()

    if (problem) {
      return toast.error(
        problem
      )
    }

    setSaving(true)
    let uploaded = []

    try {
      const result =
        await uploadProductPhotos(
          photos,
          session?.user?.id
        )

      uploaded =
        result.uploaded

      await saveProduct(
        {
          ...form,
          promotion_expires_at:
            form.promotion_enabled
              ? new Date(
                  form.promotion_expires_at
                ).toISOString()
              : null,
          photos:
            result.refs,
        },
        user,
        id
      )

      toast.success(
        isNew
          ? 'Produto cadastrado!'
          : 'Produto atualizado!'
      )

      navigate(
        '/seller/dashboard'
      )
    } catch (error) {
      await removeUploadedPhotos(
        uploaded
      )

      toast.error(
        error.message ||
          'Não foi possível salvar o produto.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() =>
          navigate(-1)
        }
        className="mb-6 flex items-center gap-1 text-sm text-gray-500 transition-colors duration-200 hover:text-[#0D1273]"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h1 className="mb-8 text-2xl font-heading font-bold text-[#0D1273]">
        {isNew
          ? 'Novo Produto'
          : 'Editar Produto'}
      </h1>

      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6">
        <div>
          <Label>
            Nome do produto
          </Label>

          <Input
            className="mt-1.5"
            value={form.name}
            onChange={event =>
              set(
                'name',
                event.target.value
              )
            }
            placeholder="Ex.: Filé de Tilápia Fresca"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Espécie</Label>
            <div className="mt-1.5">
              <SpeciesCombobox
                options={species}
                value={
                  form.species_id
                }
                onChange={value =>
                  set(
                    'species_id',
                    value
                  )
                }
                loading={
                  speciesLoading
                }
                error={
                  speciesError
                }
                fallbackText={
                  legacySpecies
                }
              />
            </div>
          </div>

          <div>
            <Label>
              Unidade de venda
            </Label>

            <Select
              className="mt-1.5"
              value={form.unit}
              onChange={event =>
                set(
                  'unit',
                  event.target.value
                )
              }
            >
              <option value="kg">
                por kg
              </option>
              <option value="unidade">
                por unidade
              </option>
              <option value="duzia">
                por dúzia
              </option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>
              Preço (R$)
            </Label>

            <Input
              className="mt-1.5"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={event =>
                set(
                  'price',
                  event.target.value
                )
              }
            />
          </div>

          <div>
            <Label>
              Quantidade disponível
            </Label>

            <Input
              className="mt-1.5"
              type="number"
              min="0"
              step="1"
              value={
                form.quantity
              }
              onChange={event =>
                set(
                  'quantity',
                  event.target.value
                )
              }
            />
          </div>
        </div>

        <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-xl bg-orange-100 p-2 text-orange-600">
                <Percent className="h-4 w-4" />
              </div>

              <div>
                <h2 className="font-semibold text-[#0D1273]">
                  Promoção
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  O preço promocional vale automaticamente até a data informada.
                </p>
              </div>
            </div>

            <input
              type="checkbox"
              checked={
                form.promotion_enabled
              }
              onChange={event =>
                set(
                  'promotion_enabled',
                  event.target.checked
                )
              }
              className="mt-1 h-5 w-5 accent-[#F2541B]"
              aria-label="Ativar promoção"
            />
          </div>

          {form.promotion_enabled && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>
                  Preço promocional (R$)
                </Label>

                <Input
                  className="mt-1.5"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    form.promotional_price
                  }
                  onChange={event =>
                    set(
                      'promotional_price',
                      event.target.value
                    )
                  }
                  required
                />
              </div>

              <div>
                <Label>
                  Promoção termina em
                </Label>

                <Input
                  className="mt-1.5"
                  type="datetime-local"
                  min={minDateTime()}
                  value={
                    form.promotion_expires_at
                  }
                  onChange={event =>
                    set(
                      'promotion_expires_at',
                      event.target.value
                    )
                  }
                  required
                />
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Espinha</Label>

            <Select
              className="mt-1.5"
              value={
                form.has_bones
                  ? 'true'
                  : 'false'
              }
              onChange={event =>
                set(
                  'has_bones',
                  event.target.value ===
                    'true'
                )
              }
            >
              <option value="true">
                Com espinha
              </option>
              <option value="false">
                Sem espinha
              </option>
            </Select>
          </div>

          <div>
            <Label>
              Tipo de água
            </Label>

            <Select
              className="mt-1.5"
              value={
                form.water_type
              }
              onChange={event =>
                set(
                  'water_type',
                  event.target.value
                )
              }
            >
              <option value="doce">
                Água doce
              </option>
              <option value="salgada">
                Água salgada
              </option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Descrição</Label>

          <Textarea
            className="mt-1.5 min-h-28"
            value={
              form.description
            }
            onChange={event =>
              set(
                'description',
                event.target.value
              )
            }
            placeholder="Descreva seu produto..."
          />
        </div>

        <div>
          <Label>
            Fotos (opcional)
          </Label>

          <div className="mt-1.5">
            <PhotoUploader
              items={photos}
              onChange={
                setPhotos
              }
              disabled={saving}
            />
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
          <span>
            <span className="block text-sm font-medium">
              Anúncio ativo
            </span>

            <span className="mt-1 block text-xs text-gray-400">
              Quando desativado, ele deixa de aparecer no marketplace.
            </span>
          </span>

          <input
            type="checkbox"
            checked={form.active}
            onChange={event =>
              set(
                'active',
                event.target.checked
              )
            }
            className="h-5 w-5 accent-[#0D1273]"
          />
        </label>

        <Button
          onClick={save}
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            'Salvando...'
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isNew
                ? 'Cadastrar Produto'
                : 'Salvar Alterações'}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
