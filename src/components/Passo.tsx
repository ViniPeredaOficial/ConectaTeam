import type { ReactNode } from 'react'

type Props = {
  numero: number
  titulo: string
  feito?: boolean
  children: ReactNode
}

// Cartão de um passo do formulário do produtor
export default function Passo({ numero, titulo, feito = false, children }: Props) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-3 text-lg font-bold text-folha-800">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base text-white ${
            feito ? 'bg-folha-600' : 'bg-gray-400'
          }`}
        >
          {feito ? '✓' : numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}
