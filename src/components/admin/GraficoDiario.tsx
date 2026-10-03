import { useState } from 'react'
import type { MouseEvent } from 'react'
import { COR_ALERTAS, COR_CHAMADOS, diaCurto, indiceMaisProximo, marcasDoEixo } from '../../lib/graficos'

export type PontoDiario = { dia: string; chamados: number; alertas: number }

// Geometria do desenho (viewBox); o SVG se ajusta à largura da tela
const W = 960
const H = 280
const ESQ = 44
const DIR = 56 // espaço para o rótulo no fim de cada linha
const TOPO = 16
const BASE = 32

const SERIES = [
  { chave: 'alertas', nome: 'Alertas', cor: COR_ALERTAS },
  { chave: 'chamados', nome: 'Chamados', cor: COR_CHAMADOS },
] as const

// Chamados e alertas por dia (últimos 30 dias): duas linhas no mesmo eixo, cursor com os valores do dia
export default function GraficoDiario({ pontos }: { pontos: PontoDiario[] }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const maximo = Math.max(...pontos.map((p) => Math.max(p.chamados, p.alertas)), 0)
  const marcas = marcasDoEixo(maximo)
  const teto = marcas.at(-1)!
  const largura = W - ESQ - DIR
  const altura = H - TOPO - BASE
  const x = (i: number) => ESQ + (pontos.length <= 1 ? 0 : (i / (pontos.length - 1)) * largura)
  const y = (v: number) => TOPO + altura - (v / teto) * altura
  const caminho = (chave: 'chamados' | 'alertas') =>
    pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p[chave]).toFixed(1)}`).join(' ')

  function aoMover(e: MouseEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setAtivo(indiceMaisProximo((e.clientX - r.left) / r.width, pontos.length))
  }

  const ultimo = pontos.length - 1
  const ponto = ativo === null ? null : pontos[ativo]

  return (
    <figure className="flex flex-col gap-3">
      {/* Legenda (duas séries: sempre presente) */}
      <ul className="flex flex-wrap gap-4 text-sm text-gray-700">
        {SERIES.map((s) => (
          <li key={s.chave} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: s.cor }} />
            {s.nome}
          </li>
        ))}
      </ul>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Chamados e alertas por dia nos últimos 30 dias">
          {/* Grade e eixo Y (recessivos) */}
          {marcas.map((m) => (
            <g key={m}>
              <line x1={ESQ} x2={W - DIR} y1={y(m)} y2={y(m)} stroke="#e7e8e3" strokeWidth="1" />
              <text x={ESQ - 8} y={y(m) + 4} textAnchor="end" fontSize="12" fill="#6b7280">
                {m}
              </text>
            </g>
          ))}
          {/* Eixo X: um dia a cada 5 e o último */}
          {pontos.map((p, i) =>
            i % 5 === 0 || i === ultimo ? (
              <text key={p.dia} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="#6b7280">
                {diaCurto(p.dia)}
              </text>
            ) : null,
          )}

          {/* Linhas */}
          {SERIES.map((s) => (
            <path key={s.chave} d={caminho(s.chave)} fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Valor no fim de cada linha (rótulo direto, só o último ponto); afastados se ficariam juntos */}
          {SERIES.map((s, i) => {
            const yA = y(pontos[ultimo].alertas)
            const yC = y(pontos[ultimo].chamados)
            const juntos = Math.abs(yA - yC) < 14
            const yRotulo = y(pontos[ultimo][s.chave]) + 4 + (juntos ? (i === 0 ? -7 : 7) : 0)
            return (
              <g key={s.chave}>
                <circle cx={x(ultimo)} cy={y(pontos[ultimo][s.chave])} r="4" fill={s.cor} stroke="#ffffff" strokeWidth="2" />
                <text x={x(ultimo) + 10} y={yRotulo} fontSize="12" fill="#374151">
                  {pontos[ultimo][s.chave]} hoje
                </text>
              </g>
            )
          })}

          {/* Cursor */}
          {ponto && ativo !== null && (
            <g>
              <line x1={x(ativo)} x2={x(ativo)} y1={TOPO} y2={TOPO + altura} stroke="#9ca3af" strokeWidth="1" />
              {SERIES.map((s) => (
                <circle key={s.chave} cx={x(ativo)} cy={y(ponto[s.chave])} r="5" fill={s.cor} stroke="#ffffff" strokeWidth="2" />
              ))}
            </g>
          )}

          {/* Área de captura do mouse, maior que as marcas */}
          <rect
            x={ESQ}
            y={TOPO}
            width={largura}
            height={altura}
            fill="transparent"
            onMouseMove={aoMover}
            onMouseLeave={() => setAtivo(null)}
          />
        </svg>

        {ponto && ativo !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow"
            style={{
              left: `${(x(ativo) / W) * 100}%`,
              transform: ativo > pontos.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="font-semibold text-gray-900">{diaCurto(ponto.dia)}</p>
            {SERIES.map((s) => (
              <p key={s.chave} className="flex items-center gap-2 text-gray-700">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                {s.nome}: <strong className="text-gray-900">{ponto[s.chave]}</strong>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Os mesmos números em tabela (acessibilidade) */}
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-folha-700">Ver os números por dia</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-600">
                <th className="py-1">Dia</th>
                <th className="py-1">Chamados</th>
                <th className="py-1">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {[...pontos].reverse().map((p) => (
                <tr key={p.dia} className="border-t border-gray-100">
                  <td className="py-1">{diaCurto(p.dia)}</td>
                  <td className="py-1">{p.chamados}</td>
                  <td className="py-1">{p.alertas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
