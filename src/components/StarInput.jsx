import React, { useRef, useState } from 'react'
import { Star } from 'lucide-react'

export const RATING_LABELS = ['Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente']

// Escolha de nota 1-5. Acessível: radiogroup, setas do teclado e rótulo falado.
export default function StarInput({ value, onChange, disabled = false, size = 36 }) {
  const [hover, setHover] = useState(0)
  const refs = useRef([])
  const shown = hover || value

  const move = (e, delta) => {
    e.preventDefault()
    const next = Math.min(5, Math.max(1, (value || (delta > 0 ? 0 : 6)) + delta))
    onChange(next)
    refs.current[next - 1]?.focus()
  }
  const onKeyDown = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') move(e, 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') move(e, -1)
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Nota de 1 a 5 estrelas" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            ref={el => { refs.current[n - 1] = el }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}: ${RATING_LABELS[n - 1]}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onKeyDown={onKeyDown}
            className="p-0.5 rounded-lg transition-transform duration-150 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5A5FBF] disabled:opacity-50"
          >
            <Star style={{ width: size, height: size }} className={`transition-colors duration-150 ${n <= shown ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-1.5 h-5 text-sm font-medium text-[#0D1273]">{shown ? RATING_LABELS[shown - 1] : <span className="text-gray-400 font-normal">Toque numa estrela</span>}</p>
    </div>
  )
}
