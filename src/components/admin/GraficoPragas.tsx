import { COR_ALERTAS } from '../../lib/graficos'

export type PragaResumo = { praga: string; cientifico: string | null; alertas: number; municipios: number; ultimo: string }

const MAXIMO_BARRAS = 8

// Pragas com mais alertas: barras horizontais de uma série (o título diz o que é; sem legenda)
export default function GraficoPragas({ pragas }: { pragas: PragaResumo[] }) {
  if (!pragas.length) return <p className="text-gray-600">Nenhum alerta no período.</p>
  const visiveis = pragas.slice(0, MAXIMO_BARRAS)
  const outras = pragas.slice(MAXIMO_BARRAS).reduce((soma, p) => soma + p.alertas, 0)
  const maximo = Math.max(...visiveis.map((p) => p.alertas))

  return (
    <ul className="flex flex-col gap-3">
      {visiveis.map((p) => (
        <li key={p.praga} className="group grid grid-cols-[minmax(0,12rem)_1fr] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900" title={p.praga}>
              {p.praga}
            </p>
            {p.cientifico && <p className="truncate text-xs italic text-gray-500">{p.cientifico}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* Barra: até 20 px de espessura, ponta arredondada só no fim */}
            <div
              className="h-5 rounded-r opacity-90 transition-opacity group-hover:opacity-100"
              style={{ width: `${Math.max(2, (p.alertas / maximo) * 100)}%`, backgroundColor: COR_ALERTAS }}
              role="img"
              aria-label={`${p.praga}: ${p.alertas} alertas`}
            />
            <span className="shrink-0 text-sm font-semibold text-gray-900">{p.alertas}</span>
          </div>
          <p className="col-start-2 -mt-2 text-xs text-gray-500">
            {p.municipios} {p.municipios === 1 ? 'município' : 'municípios'} · último em{' '}
            {new Date(p.ultimo).toLocaleDateString('pt-BR')}
          </p>
        </li>
      ))}
      {outras > 0 && (
        <li className="text-sm text-gray-600">
          + {outras} alertas de outras {pragas.length - MAXIMO_BARRAS} pragas
        </li>
      )}
    </ul>
  )
}
