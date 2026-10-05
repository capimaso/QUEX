import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Foto grande + miniaturas. Sem fotos, mostra a imagem padrão.
export default function ProductGallery({ images, alt, fallback }) {
  const list = images?.length ? images : [fallback]
  const key = list.join('|')
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex(0) }, [key])
  const current = Math.min(index, list.length - 1)
  const go = delta => setIndex(i => (i + delta + list.length) % list.length)
  const onError = e => { if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback }

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-100">
        <img src={list[current]} alt={alt} onError={onError} className="w-full h-full object-cover" />
        {list.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors duration-200"><ChevronLeft className="w-5 h-5 text-[#0D1273]" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors duration-200"><ChevronRight className="w-5 h-5 text-[#0D1273]" /></button>
            <span className="absolute right-3 bottom-3 rounded-full bg-black/55 text-white text-xs px-2.5 py-1">{current + 1}/{list.length}</span>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button key={`${i}-${src}`} type="button" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1} de ${list.length}`} aria-current={i === current} className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-colors duration-200 ${i === current ? 'border-[#0D1273]' : 'border-transparent opacity-70 hover:opacity-100'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
