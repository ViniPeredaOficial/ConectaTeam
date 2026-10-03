import type { ReactNode } from 'react'

type Props = {
  numero: number
  titulo: string
  feito?: boolean
  children: ReactNode
}

// Etapa do formulário de ocorrência do produtor
export default function Passo({ numero, titulo, feito = false, children }: Props) {
  return (
    <section className="rounded-2xl border border-folha-200 bg-white p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-bold text-folha-900">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            feito ? 'bg-folha-700 text-white' : 'bg-folha-100 text-folha-800'
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
