import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

type Props = {
  src: string
  alt: string
  className?: string // estilo da miniatura/foto na página
  mostrarSelo?: boolean // "🔍 Ampliar" sobre a foto (desligar em miniaturas pequenas)
}

const ZOOM = 2.5

// Foto que abre em tela cheia ao tocar; na tela cheia, tocar aproxima no ponto tocado
export default function FotoAmpliavel({ src, alt, className = '', mostrarSelo = true }: Props) {
  const [aberta, setAberta] = useState(false)
  const [ampliada, setAmpliada] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const pontoTocado = useRef<{ x: number; y: number } | null>(null)

  // Esc fecha; a página por trás não rola enquanto a foto está aberta
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', aoTeclar)
    const rolagemAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = rolagemAntes
    }
  }, [aberta])

  // Depois de aproximar, centraliza a área no ponto que foi tocado
  useEffect(() => {
    const caixa = area.current
    const ponto = pontoTocado.current
    if (!ampliada || !caixa || !ponto) return
    caixa.scrollLeft = ponto.x * caixa.scrollWidth - caixa.clientWidth / 2
    caixa.scrollTop = ponto.y * caixa.scrollHeight - caixa.clientHeight / 2
  }, [ampliada])

  function fechar() {
    setAberta(false)
    setAmpliada(false)
  }

  function alternarZoom(e: MouseEvent<HTMLImageElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    pontoTocado.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    setAmpliada((z) => !z)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="group relative block w-full"
        aria-label={`Ampliar: ${alt}`}
      >
        <img src={src} alt={alt} className={className} />
        {mostrarSelo && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
            🔍 Ampliar
          </span>
        )}
      </button>

      {aberta && (
        <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[2000] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-2 text-sm text-white">
            <span>{ampliada ? 'Arraste para ver os detalhes. Toque para afastar.' : 'Toque na foto para aproximar.'}</span>
            <button onClick={fechar} className="min-h-10 rounded-lg px-3 text-2xl" aria-label="Fechar">
              ✕
            </button>
          </div>
          <div ref={area} className={`flex-1 ${ampliada ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}>
            <img
              src={src}
              alt={alt}
              onClick={alternarZoom}
              style={ampliada ? { width: `${ZOOM * 100}%`, maxWidth: 'none' } : undefined}
              className={ampliada ? 'cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}
            />
          </div>
        </div>
      )}
    </>
  )
}
