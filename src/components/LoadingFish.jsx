import React from 'react'

const SIZE = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

export default function LoadingFish({
  size = 'md',
  label = 'Carregando...',
  fullscreen = false,
  className = '',
}) {
  const fish = (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <img
        src="/assets/images/loading/loading-fish.svg"
        alt=""
        aria-hidden="true"
        className={`quex-loading-fish ${SIZE[size] || SIZE.md}`}
      />
      <span className="sr-only">{label}</span>
    </div>
  )

  if (!fullscreen) return fish

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        {fish}
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
