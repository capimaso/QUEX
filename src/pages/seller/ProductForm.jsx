import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, listSpecies, removeUploadedPhotos, saveProduct, uploadProductPhotos } from '@/api/data'
import PhotoUploader from '@/components/PhotoUploader'
import SpeciesCombobox from '@/components/SpeciesCombobox'
import { Button, Input, Label, Textarea, Select } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const EMPTY = { name: '', price: '', description: '', quantity: '', species_id: '', unit: 'kg', active: true, has_bones: false, water_type: 'doce' }

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const isNew = id === 'new'
  const [form, setForm] = useState(EMPTY)
  const [photos, setPhotos] = useState([]) // [{ key, url, ref | file }]
  const [legacySpecies, setLegacySpecies] = useState('') // produto antigo com espécie em texto livre
  const [species, setSpecies] = useState([])
  const [speciesLoading, setSpeciesLoading] = useState(true)
  const [speciesError, setSpeciesError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  useEffect(() => {
    listSpecies()
      .then(setSpecies)
      .catch(() => setSpeciesError('Não foi possível carregar a lista de espécies.'))
      .finally(() => setSpeciesLoading(false))
  }, [])

  useEffect(() => {
    if (isNew) return
    getProduct(id, true)
      .then(p => {
        if (!p) throw new Error('Produto não encontrado.')
        setForm({
          name: p.name, price: String(p.price), description: p.description || '', quantity: String(p.quantity),
          species_id: p.species_id ?? '', unit: p.unit || 'kg', active: p.active, has_bones: p.has_bones, water_type: p.water_type || 'doce',
        })
        setLegacySpecies(p.species_id ? '' : p.species || '')
        setPhotos((p.photos || []).map((photo, i) => ({ key: `r${i}-${photo.ref}`, ref: photo.ref, url: photo.url })))
      })
      .catch(e => { toast.error(e.message); navigate('/seller/dashboard') })
  }, [id, isNew, navigate])

  if (user?.role !== 'seller') return <Navigate to="/" replace />

  const validate = () => {
    if (!form.name.trim()) return 'Nome obrigatório.'
    if (!form.species_id) return 'Escolha uma espécie da lista.'
    if (!(Number(form.price) > 0)) return 'O preço deve ser maior que zero.'
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) return 'A quantidade deve ser um número inteiro não negativo.'
    return ''
  }

  const save = async () => {
    const problem = validate()
    if (problem) return toast.error(problem)
    setSaving(true)
    let uploaded = []
    try {
      // 1) sobe só as fotos novas   2) salva o produto com a lista final   3) se o passo 2 falhar, apaga o que subiu
      const result = await uploadProductPhotos(photos, session?.user?.id)
      uploaded = result.uploaded
      await saveProduct({ ...form, photos: result.refs }, user, id)
      toast.success(isNew ? 'Produto cadastrado!' : 'Produto atualizado!')
      navigate('/seller/dashboard')
    } catch (e) {
      await removeUploadedPhotos(uploaded)
      toast.error(e.message || 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0D1273] transition-colors duration-200 mb-6"><ArrowLeft className="w-4 h-4" />Voltar</button>
      <h1 className="text-2xl font-heading font-bold text-[#0D1273] mb-8">{isNew ? 'Novo Produto' : 'Editar Produto'}</h1>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div><Label>Nome do produto</Label><Input className="mt-1.5" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex.: Filé de Tilápia Fresca" /></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Espécie</Label>
            <div className="mt-1.5"><SpeciesCombobox options={species} value={form.species_id} onChange={v => set('species_id', v)} loading={speciesLoading} error={speciesError} fallbackText={legacySpecies} /></div>
          </div>
          <div><Label>Unidade de venda</Label><Select className="mt-1.5" value={form.unit} onChange={e => set('unit', e.target.value)}><option value="kg">por kg</option><option value="unidade">por unidade</option><option value="duzia">por dúzia</option></Select></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Preço (R$)</Label><Input className="mt-1.5" type="number" min="0.01" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} /></div>
          <div><Label>Quantidade disponível</Label><Input className="mt-1.5" type="number" min="0" step="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Espinha</Label><Select className="mt-1.5" value={form.has_bones ? 'true' : 'false'} onChange={e => set('has_bones', e.target.value === 'true')}><option value="true">Com espinha</option><option value="false">Sem espinha</option></Select></div>
          <div><Label>Tipo de água</Label><Select className="mt-1.5" value={form.water_type} onChange={e => set('water_type', e.target.value)}><option value="doce">Água doce</option><option value="salgada">Água salgada</option></Select></div>
        </div>

        <div><Label>Descrição</Label><Textarea className="mt-1.5 min-h-28" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descreva seu produto..." /></div>

        <div><Label>Fotos (opcional)</Label><div className="mt-1.5"><PhotoUploader items={photos} onChange={setPhotos} disabled={saving} /></div></div>

        <label className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
          <span><span className="block text-sm font-medium">Anúncio ativo</span><span className="block text-xs text-gray-400 mt-1">Quando desativado, ele deixa de aparecer no marketplace.</span></span>
          <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="w-5 h-5 accent-[#0D1273]" />
        </label>

        <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" />{isNew ? 'Cadastrar Produto' : 'Salvar Alterações'}</>}</Button>
      </div>
    </div>
  )
}
