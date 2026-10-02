import React, { useEffect, useState } from 'react'

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'

// Foto redonda; se não tiver (ou falhar ao carregar) mostra as iniciais.
export default function Avatar({ src, name, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }
  if (src && !broken) {
    return <img src={src} alt={name ? `Foto de ${name}` : 'Foto de perfil'} style={style} onError={() => setBroken(true)} className={`rounded-full object-cover bg-gray-100 flex-shrink-0 ${className}`} />
  }
  return <div style={style} aria-label={name} className={`rounded-full bg-[#0D1273] text-white font-semibold flex items-center justify-center flex-shrink-0 ${className}`}>{initials(name)}</div>
}
