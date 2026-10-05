import React, { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { ImagePlus, Plus, Star, X } from 'lucide-react'
import { AVATAR_ACCEPT, AVATAR_MAX_INPUT_MB } from '@/lib/image'

export const MAX_PHOTOS = 6
const ACCEPTED = AVATAR_ACCEPT.split(',')
const newKey = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// Upload múltiplo com preview. A ordem importa: a 1ª foto é a capa.
// items: [{ key, url, ref }]  (já salva)  ou  [{ key, url, file }]  (nova, ainda no navegador)
export default function PhotoUploader({ items, onChange, max = MAX_PHOTOS, disabled = false }) {
  const input = useRef(null)
  const latest = useRef(items)
  latest.current = items
  useEffect(() => () => { latest.current.forEach(i => i.file && URL.revokeObjectURL(i.url)) }, [])

  const pick = e => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!files.length) return
    const problems = new Set()
    const valid = []
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) problems.add('Use imagens JPG, PNG ou WebP.')
      else if (file.size > AVATAR_MAX_INPUT_MB * 1024 * 1024) problems.add(`Cada foto pode ter até ${AVATAR_MAX_INPUT_MB} MB.`)
      else valid.push(file)
    }
    const room = Math.max(max - items.length, 0)
    if (valid.length > room) problems.add(`Máximo de ${max} fotos por produto.`)
    problems.forEach(message => toast.error(message))
    const added = valid.slice(0, room).map(file => ({ key: newKey(), file, url: URL.createObjectURL(file) }))
    if (added.length) onChange([...items, ...added])
  }
  const remove = key => {
    const item = items.find(i => i.key === key)
    if (item?.file) URL.revokeObjectURL(item.url)
    onChange(items.filter(i => i.key !== key))
  }
  const makeCover = key => {
    const item = items.find(i => i.key === key)
    if (item) onChange([item, ...items.filter(i => i.key !== key)])
  }
  const open = () => input.current?.click()

  return (
    <div>
      <input ref={input} type="file" multiple accept={AVATAR_ACCEPT} className="hidden" onChange={pick} data-testid="photo-input" />
      {items.length === 0 ? (
        <button type="button" disabled={disabled} onClick={open} className="w-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#5A5FBF]/60 hover:bg-[#5A5FBF]/5 transition-colors duration-200 py-10 flex flex-col items-center gap-2 text-gray-500 disabled:opacity-50">
          <ImagePlus className="w-8 h-8 text-[#5A5FBF]" />
          <span className="font-medium text-[#0D1273]">Adicionar fotos</span>
          <span className="text-xs">JPG, PNG ou WebP · até {max} fotos</span>
        </button>
      ) : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {items.map((item, index) => (
            <li key={item.key} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group">
              <img src={item.url} alt={`Foto ${index + 1} do produto`} className="w-full h-full object-cover" />
              {index === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#0D1273] text-white text-[10px] font-medium px-2 py-0.5">Capa</span>}
              <button type="button" disabled={disabled} onClick={() => remove(item.key)} aria-label={`Remover foto ${index + 1}`} className="absolute right-1.5 top-1.5 w-7 h-7 rounded-full bg-white/90 text-gray-700 hover:bg-red-50 hover:text-red-600 shadow flex items-center justify-center transition-colors duration-200 disabled:opacity-50"><X className="w-4 h-4" /></button>
              {index > 0 && <button type="button" disabled={disabled} onClick={() => makeCover(item.key)} aria-label={`Tornar a foto ${index + 1} a capa`} className="absolute left-1.5 bottom-1.5 rounded-full bg-white/90 text-[#0D1273] hover:bg-white shadow text-[10px] font-medium px-2 py-1 flex items-center gap-1 transition-colors duration-200 disabled:opacity-50"><Star className="w-3 h-3" />Capa</button>}
            </li>
          ))}
          {items.length < max && (
            <li>
              <button type="button" disabled={disabled} onClick={open} aria-label="Adicionar mais fotos" className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-[#5A5FBF]/60 hover:bg-[#5A5FBF]/5 transition-colors duration-200 flex flex-col items-center justify-center gap-1 text-gray-500 disabled:opacity-50"><Plus className="w-6 h-6 text-[#5A5FBF]" /><span className="text-xs">Adicionar</span></button>
            </li>
          )}
        </ul>
      )}
      <p className="mt-2 text-xs text-gray-400">{items.length}/{max} fotos{items.length > 0 ? ' · a primeira é a capa do anúncio' : ''}</p>
    </div>
  )
}
