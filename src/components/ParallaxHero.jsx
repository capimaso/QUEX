import React, { useEffect, useRef } from 'react'

export default function ParallaxHero({
  children,
  className = '',
}) {
  const imageRef = useRef(null)
  const frameRef = useRef(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    const syncPreference = () => {
      reducedMotionRef.current =
        media.matches
    }

    syncPreference()

    media.addEventListener?.(
      'change',
      syncPreference
    )

    return () => {
      media.removeEventListener?.(
        'change',
        syncPreference
      )

      if (frameRef.current) {
        cancelAnimationFrame(
          frameRef.current
        )
      }
    }
  }, [])

  const move = event => {
    if (
      reducedMotionRef.current ||
      !imageRef.current
    ) {
      return
    }

    const bounds =
      event.currentTarget.getBoundingClientRect()

    const relativeX =
      (event.clientX - bounds.left) /
        bounds.width -
      0.5

    const relativeY =
      (event.clientY - bounds.top) /
        bounds.height -
      0.5

    /*
      Movimento propositalmente leve,
      mas agora perceptível:
      aproximadamente 24 px no eixo X
      e 16 px no eixo Y.
    */
    const moveX = relativeX * 24
    const moveY = relativeY * 16

    if (frameRef.current) {
      cancelAnimationFrame(
        frameRef.current
      )
    }

    frameRef.current =
      requestAnimationFrame(() => {
        if (!imageRef.current) return

        imageRef.current.style.transform =
          `translate3d(${moveX}px, ${moveY}px, 0) scale(1.06)`
      })
  }

  const reset = () => {
    if (!imageRef.current) return

    imageRef.current.style.transform =
      'translate3d(0, 0, 0) scale(1.06)'
  }

  return (
    <section
      className={`quex-parallax-hero relative overflow-hidden text-white ${className}`}
      onMouseMove={move}
      onMouseLeave={reset}
    >
      {/*
        Usamos <img> em vez de background-image.
        Assim nenhuma regra de background do dark mode
        consegue esconder a foto.
      */}
      <img
        ref={imageRef}
        src="/assets/images/hero/hero-default.jpg"
        alt=""
        aria-hidden="true"
        draggable="false"
        className="quex-parallax-image pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
      />

      {/*
        Overlay neutro e muito leve.
        Ele ajuda o texto branco sem tingir a foto
        de azul/roxo.
      */}
      <div
        aria-hidden="true"
        className="quex-parallax-overlay pointer-events-none absolute inset-0"
      />

      <div className="relative z-10">
        {children}
      </div>
    </section>
  )
}
