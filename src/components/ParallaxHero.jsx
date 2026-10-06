import React, { useEffect, useRef } from 'react'

export default function ParallaxHero({ children, className = '' }) {
  const layerRef = useRef(null)
  const frameRef = useRef(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reducedMotionRef.current = media.matches
    }

    sync()
    media.addEventListener?.('change', sync)

    return () => {
      media.removeEventListener?.('change', sync)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const move = event => {
    if (reducedMotionRef.current || event.pointerType === 'touch') return

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5

    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    frameRef.current = requestAnimationFrame(() => {
      if (!layerRef.current) return
      layerRef.current.style.transform =
        `translate3d(${x * 16}px, ${y * 12}px, 0) scale(1.045)`
    })
  }

  const reset = () => {
    if (!layerRef.current) return
    layerRef.current.style.transform = 'translate3d(0, 0, 0) scale(1.045)'
  }

  return (
    <section
      className={`relative overflow-hidden bg-[#0D1273] text-white ${className}`}
      onPointerMove={move}
      onPointerLeave={reset}
    >
      <div
        ref={layerRef}
        aria-hidden="true"
        className="quex-parallax-layer pointer-events-none absolute -inset-5 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/assets/images/hero/hero-default.jpg')",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[#0D1273]/80"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
      >
        <div className="absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/3 rounded-full bg-gradient-to-br from-[#F29E38] to-[#F2541B] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 -translate-x-1/4 translate-y-1/3 rounded-full bg-gradient-to-br from-[#5A5FBF] to-[#0D1273] blur-3xl" />
      </div>

      <div className="relative z-10">
        {children}
      </div>
    </section>
  )
}
