import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Fish, MapPin, Plus, Minus, ShoppingCart, Bone, Waves } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, addToCart, fallbackImage } from '@/api/data'
import { Button, Badge } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

const unitLabel = (u) => u === 'unit' ? 'unidade' : u === 'dozen' ? 'dúzia' : 'kg'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)

  useEffect(() => { getProduct(id).then(setProduct).catch(console.error).finally(() => setLoading(false)) }, [id])
  const add = async () => {
    if (!user || user.role === 'seller') return toast.error('Somente compradores podem adicionar itens ao carrinho.')
    setAdding(true)
    try { await addToCart(user, product, qty); toast.success('Adicionado ao carrinho!'); navigate('/cart') } catch (e) { toast.error(e.message) } finally { setAdding(false) }
  }

  if (loading) return <div className="flex justify-center py-32"><div className="w-8 h-8 border-4 border-[#5A5FBF]/20 border-t-[#0D1273] rounded-full animate-spin" /></div>
  if (!product) return <div className="max-w-4xl mx-auto px-4 py-20 text-center"><Fish className="w-16 h-16 mx-auto mb-4 text-gray-300" /><h2 className="text-xl font-semibold text-gray-600">Produto não encontrado</h2><Button variant="ghost" onClick={() => navigate('/marketplace')} className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Voltar ao Marketplace</Button></div>

  const inStock = product.quantity > 0
  return <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0D1273] mb-6"><ArrowLeft className="w-4 h-4" />Voltar</button>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100"><img src={product.image_url || fallbackImage} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = fallbackImage }} /></div>
      <div className="space-y-6">
        <div>{product.species && <Badge className="mb-3 gradient-bg text-white"><Fish className="w-3 h-3 mr-1" />{product.species}</Badge>}<div className="flex gap-2 flex-wrap mb-3"><Badge className="bg-[#0D1273]/5 text-[#0D1273]">{product.category === 'iguaria' ? 'Iguaria' : 'Peixe'}</Badge><Badge className="bg-[#0D1273]/5 text-[#0D1273]"><Bone className="w-3 h-3 mr-1" />{product.has_bones ? 'Com espinha' : 'Sem espinha'}</Badge><Badge className="bg-[#0D1273]/5 text-[#0D1273]"><Waves className="w-3 h-3 mr-1" />{product.water_type === 'salgada' ? 'Água salgada' : 'Água doce'}</Badge></div><h1 className="text-3xl font-heading font-bold text-[#0D1273]">{product.name}</h1>{product.seller_name && <p className="text-gray-500 flex items-center gap-1 mt-2"><MapPin className="w-4 h-4" />Vendido por {product.seller_name}</p>}</div>
        <div className="flex items-baseline gap-2"><span className="text-4xl font-bold text-[#0D1273]">R$ {product.price.toFixed(2)}</span><span className="text-gray-400">/{unitLabel(product.unit)}</span></div>
        <p className="text-gray-600 leading-relaxed whitespace-pre-line">{product.description || 'Este anúncio ainda não possui descrição.'}</p>
        <div className="flex items-center gap-3"><Badge className={inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>{inStock ? `${product.quantity} em estoque` : 'Sem estoque'}</Badge></div>
        {!user || user.role !== 'seller' ? <div className="flex items-center gap-3"><div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white"><button disabled={qty <= 1} onClick={() => setQty(v => Math.max(1,v-1))} className="p-3 hover:bg-gray-50 disabled:opacity-40"><Minus className="w-4 h-4" /></button><span className="w-10 text-center font-medium">{qty}</span><button disabled={qty >= product.quantity} onClick={() => setQty(v => Math.min(product.quantity,v+1))} className="p-3 hover:bg-gray-50 disabled:opacity-40"><Plus className="w-4 h-4" /></button></div><button onClick={add} disabled={!inStock || adding} className="gradient-btn flex-1 py-3 rounded-xl flex items-center justify-center gap-2"><ShoppingCart className="w-4 h-4" />{adding ? 'Adicionando...' : 'Adicionar ao carrinho'}</button></div> : null}
      </div>
    </div>
  </div>
}
