import React, { useEffect, useRef } from 'react'

export default function ParallaxHero({
  children,
  className = '',
}) {
  const heroRef = useRef(null)
  const imageRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const hero = heroRef.current
    const image = imageRef.current

    if (!hero || !image) return

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let running = false

    const render = () => {
      /*
        Interpolação:
        a imagem "segue" o mouse em vez de pular diretamente
        para a nova posição.
      */
      currentX +=
        (targetX - currentX) * 0.14

      currentY +=
        (targetY - currentY) * 0.14

      image.style.transform =
        `translate3d(${currentX}px, ${currentY}px, 0) scale(1.09)`

      const distance =
        Math.abs(targetX - currentX) +
        Math.abs(targetY - currentY)

      if (distance > 0.08) {
        animationRef.current =
          requestAnimationFrame(render)
      } else {
        currentX = targetX
        currentY = targetY

        image.style.transform =
          `translate3d(${currentX}px, ${currentY}px, 0) scale(1.09)`

        running = false
        animationRef.current = null
      }
    }

    const requestRender = () => {
      if (running) return

      running = true
      animationRef.current =
        requestAnimationFrame(render)
    }

    const handlePointerMove = event => {
      /*
        Touch não usa parallax, porque não existe cursor
        e o movimento poderia atrapalhar o scroll.
      */
      if (event.pointerType === 'touch') {
        return
      }

      const rect =
        hero.getBoundingClientRect()

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return
      }

      /*
        Valor entre -1 e 1.
        Centro do Hero = 0.
      */
      const normalizedX =
        ((event.clientX - rect.left) /
          rect.width -
          0.5) *
        2

      const normalizedY =
        ((event.clientY - rect.top) /
          rect.height -
          0.5) *
        2

      /*
        Movimento suficiente para ser percebido,
        mas ainda discreto.
      */
      targetX = normalizedX * 30
      targetY = normalizedY * 20

      requestRender()
    }

    const handlePointerLeave = () => {
      targetX = 0
      targetY = 0
      requestRender()
    }

    hero.addEventListener(
      'pointermove',
      handlePointerMove,
      { passive: true }
    )

    hero.addEventListener(
      'pointerleave',
      handlePointerLeave
    )

    return () => {
      hero.removeEventListener(
        'pointermove',
        handlePointerMove
      )

      hero.removeEventListener(
        'pointerleave',
        handlePointerLeave
      )

      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        )
      }
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className={`quex-parallax-hero relative overflow-hidden text-white ${className}`}
    >
      <img
        ref={imageRef}
        src="/assets/images/hero/hero-default.jpg"
        alt=""
        aria-hidden="true"
        draggable="false"
        className="quex-parallax-image pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
      />

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
