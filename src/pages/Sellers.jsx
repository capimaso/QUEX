import React, { useEffect, useState } from 'react'
import { Search, MapPin, Store } from 'lucide-react'
import SellerCard from '@/components/SellerCard'
import { Button, Input } from '@/components/ui'
import { listSellers } from '@/api/data'

const PAGE = 24

export default function Sellers() {
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')

  // busca com debounce: espera a pessoa parar de digitar
  useEffect(() => {
    let active = true
    setLoading(true)
    const t = setTimeout(() => {
      listSellers({ search: name, location: place, limit: PAGE })
        .then(list => { if (active) { setSellers(list); setMore(list.length === PAGE); setError('') } })
        .catch(e => { if (active) setError(e.message || 'Não foi possível carregar os vendedores.') })
        .finally(() => { if (active) setLoading(false) })
    }, 350)
    return () => { active = false; clearTimeout(t) }
  }, [name, place])

  const loadMore = async () => {
    const next = await listSellers({ search: name, location: place, limit: PAGE, offset: sellers.length })
    setSellers(prev => [...prev, ...next])
    setMore(next.length === PAGE)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-[#0D1273]">Vendedores</h1>
        <p className="text-gray-500 mt-1">Encontre pescadores e peixarias pelo nome ou pela região.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-8 max-w-2xl">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" value={name} onChange={e => setName(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar por nome" /></div>
        <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-10" value={place} onChange={e => setPlace(e.target.value)} placeholder="Cidade ou região" aria-label="Buscar por localização" /></div>
      </div>
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm mb-4">{error}</div>}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}</div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Store className="w-10 h-10 mx-auto mb-3" /><p>Nenhum vendedor encontrado.</p></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{sellers.map(s => <SellerCard key={s.id} seller={s} />)}</div>
          {more && <div className="text-center mt-8"><Button variant="outline" onClick={loadMore}>Carregar mais</Button></div>}
        </>
      )}
    </div>
  )
}
