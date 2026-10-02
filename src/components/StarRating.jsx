import React from 'react'
import { Star } from 'lucide-react'

// average: número (0-5) ou null; count: quantidade de avaliações
export default function StarRating({ average, count = 0, size = 16, className = '' }) {
  if (!count || average == null) return <span className={`text-xs text-gray-400 ${className}`}>Sem avaliações ainda</span>
  const rounded = Math.round(average)
  const label = Number(average).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label={`Nota ${label} de 5, ${count} avaliações`}>
      <span className="inline-flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} style={{ width: size, height: size }} className={n <= rounded ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />)}</span>
      <span className="text-sm font-medium text-[#0D1273]">{label}</span>
      <span className="text-xs text-gray-400">({count})</span>
    </span>
  )
}
