import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Recorte } from '../lib/imagem'

type Props = {
  src: string
  recorte: Recorte | null
  onChange: (recorte: Recorte | null) => void
}

// Recorte simples: arraste sobre a foto para marcar a área. Sem marcação, usa a foto inteira.
export default function RecorteImagem({ src, recorte, onChange }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null)

  // Posição do ponteiro em proporção da imagem (0 a 1)
  function posicao(e: PointerEvent) {
    const r = caixa.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  function aoPressionar(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setInicio(posicao(e))
  }

  function aoMover(e: PointerEvent) {
    if (!inicio) return
    const p = posicao(e)
    onChange({
      x: Math.min(inicio.x, p.x),
      y: Math.min(inicio.y, p.y),
      largura: Math.abs(p.x - inicio.x),
      altura: Math.abs(p.y - inicio.y),
    })
  }

  function aoSoltar() {
    setInicio(null)
    // Arrasto muito pequeno vira clique: volta para a foto inteira
    if (recorte && (recorte.largura < 0.05 || recorte.altura < 0.05)) onChange(null)
  }

  return (
    <div>
      <div
        ref={caixa}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-xl"
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
      >
        <img src={src} alt="Foto do produtor para recorte" className="block w-full" draggable={false} />
        {recorte && (
          <div
            className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{
              left: `${recorte.x * 100}%`,
              top: `${recorte.y * 100}%`,
              width: `${recorte.largura * 100}%`,
              height: `${recorte.altura * 100}%`,
            }}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {recorte ? 'Só a área marcada vai no alerta.' : 'Arraste sobre a foto para recortar (ex.: tirar rosto ou casa).'}
        </span>
        {recorte && (
          <button type="button" className="font-semibold text-folha-700 underline" onClick={() => onChange(null)}>
            Usar foto inteira
          </button>
        )}
      </div>
    </div>
  )
}
