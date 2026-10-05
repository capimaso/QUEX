import React from 'react'
import { Star } from 'lucide-react'

// Distribuição das notas: 5★ ██████ 12 ... 1★ ░ 0  (só números, nunca quem avaliou)
export default function RatingBars({ distribution, count }) {
  if (!distribution || !count) return null
  return (
    <div className="space-y-1.5 w-full max-w-xs" aria-label="Distribuição das avaliações">
      {[5, 4, 3, 2, 1].map(n => {
        const value = Number(distribution[n] || 0)
        const pct = Math.round((value / count) * 100)
        return (
          <div key={n} className="flex items-center gap-2 text-xs text-gray-500" aria-label={`${n} estrelas: ${value} ${value === 1 ? 'avaliação' : 'avaliações'}`}>
            <span className="w-6 inline-flex items-center gap-0.5">{n}<Star className="w-3 h-3 text-amber-400 fill-amber-400" /></span>
            <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><span className="block h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${pct}%` }} /></span>
            <span className="w-6 text-right tabular-nums">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
