import { useEffect, useState } from 'react'
import { buscarRiscos, pesoDoRisco } from '../lib/clima'
import { supabase } from '../lib/supabase'
import type { Local, Nivel, Risco } from '../lib/clima'

const ESTILO: Record<Nivel, { texto: string; classes: string }> = {
  alto: { texto: 'Alto', classes: 'bg-red-100 text-red-800' },
  medio: { texto: 'Médio', classes: 'bg-amber-100 text-amber-900' },
  baixo: { texto: 'Baixo', classes: 'bg-folha-100 text-folha-800' },
}

function Selo({ nivel }: { nivel: Nivel }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ESTILO[nivel].classes}`}>{ESTILO[nivel].texto}</span>
}

// Cartão de um município: dois indicadores, chuva e temperaturas
export function CartaoRisco({ nome, risco }: { nome: string; risco: Risco }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="font-bold text-gray-900">{nome}</h3>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt>🍄 Doenças fúngicas</dt>
          <dd className="flex items-center gap-2">
            <span className="text-gray-500">{risco.fungos.horas} h úmidas</span>
            <Selo nivel={risco.fungos.nivel} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>🐛 Pragas de tempo seco</dt>
          <dd className="flex items-center gap-2">
            <span className="text-gray-500">{risco.seco.horas} h secas</span>
            <Selo nivel={risco.seco.nivel} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-gray-600">
        🌧️ {risco.chuvaMm.toLocaleString('pt-BR')} mm · 🌡️ {risco.tMin}° a {risco.tMax}°
      </p>
    </article>
  )
}

export function NotaClima() {
  return (
    <p className="text-xs text-gray-500">
      Indicador simplificado a partir da previsão do tempo para as próximas 72 h (fungos: horas com umidade ≥ 90% e 12
      a 26 °C; tempo seco: horas acima de 28 °C com umidade abaixo de 50%). Não substitui a avaliação da CATI. Previsão:{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
        Open-Meteo.com
      </a>{' '}
      (CC-BY 4.0).
    </p>
  )
}

// Clima de um município só (painel do especialista, na análise do chamado)
export function ClimaDoMunicipio({ cod }: { cod: number }) {
  const [dados, setDados] = useState<{ nome: string; risco: Risco } | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    supabase
      .from('municipios')
      .select('cod_ibge, nome, lat, lon')
      .eq('cod_ibge', cod)
      .single()
      .then(async ({ data, error }) => {
        if (error) throw error
        const riscos = await buscarRiscos([{ cod: data.cod_ibge, nome: data.nome, lat: data.lat, lon: data.lon }])
        setDados({ nome: data.nome, risco: riscos.get(data.cod_ibge)! })
      })
      .then(undefined, () => setErro(true))
  }, [cod])

  if (erro) return null
  if (!dados) return <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
  return (
    <div className="flex flex-col gap-2">
      <CartaoRisco nome={`Clima em ${dados.nome} nos próximos 3 dias`} risco={dados.risco} />
      <NotaClima />
    </div>
  )
}

type Props = { locais: Local[]; mostrarInicial?: number }

// Lista de municípios ordenada do maior para o menor risco
export default function RiscoClima({ locais, mostrarInicial = 6 }: Props) {
  const [riscos, setRiscos] = useState<Map<number, Risco> | null>(null)
  const [erro, setErro] = useState(false)
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    if (!locais.length) return
    buscarRiscos(locais)
      .then(setRiscos)
      .catch((e) => {
        console.error('Falha na previsão do tempo', e)
        setErro(true)
      })
  }, [locais])

  if (erro) return <p className="text-sm text-gray-600">Previsão do tempo indisponível agora.</p>
  if (!riscos) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-32 animate-pulse rounded-2xl bg-white/60" />
        ))}
      </div>
    )
  }

  const ordenados = locais
    .filter((l) => riscos.has(l.cod))
    .sort((a, b) => pesoDoRisco(riscos.get(b.cod)!) - pesoDoRisco(riscos.get(a.cod)!))
  const visiveis = todos ? ordenados : ordenados.slice(0, mostrarInicial)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map((l) => (
          <CartaoRisco key={l.cod} nome={l.nome} risco={riscos.get(l.cod)!} />
        ))}
      </div>
      {ordenados.length > mostrarInicial && (
        <button onClick={() => setTodos((t) => !t)} className="self-center font-semibold text-folha-700 underline">
          {todos ? 'Mostrar menos' : `Ver todos os ${ordenados.length} municípios`}
        </button>
      )}
      <NotaClima />
    </div>
  )
}
