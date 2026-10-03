import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Estatisticas = {
  alertas: number
  alertas_simulados: number
  municipios_com_alerta: number
}

const numero = (n: number) => n.toLocaleString('pt-BR')

// Faixa compacta de dados agregados do sistema.
export default function Numeros() {
  const [dados, setDados] = useState<Estatisticas | null>(null)
  const [culturas, setCulturas] = useState<number | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    Promise.all([supabase.rpc('estatisticas_publicas'), supabase.rpc('culturas_monitoradas')])
      .then(([estatisticas, monitoradas]) => {
        if (!ativo) return
        if (estatisticas.error || monitoradas.error) {
          console.error('Falha ao carregar os números públicos', estatisticas.error ?? monitoradas.error)
          setErro(true)
          return
        }
        if (!estatisticas.data || !monitoradas.data) {
          throw new Error('Resposta incompleta ao carregar números públicos')
        }
        setDados(estatisticas.data as Estatisticas)
        setCulturas((monitoradas.data as { cultura: string }[]).length)
      })
      .catch((e) => {
        console.error('Falha ao carregar os números públicos', e)
        if (ativo) setErro(true)
      })
    return () => {
      ativo = false
    }
  }, [])

  const metricas = [
    { valor: dados ? numero(dados.alertas) : '—', rotulo: 'alertas regionais' },
    { valor: dados ? numero(dados.municipios_com_alerta) : '—', rotulo: 'municípios alcançados' },
    { valor: culturas === null ? '—' : numero(culturas), rotulo: 'culturas monitoradas' },
  ]

  return (
    <section aria-label="Números do Radar">
      <h2 className="sr-only">O Radar em números</h2>
      <div className="grid sm:grid-cols-3">
        {metricas.map((metrica) => (
          <div key={metrica.rotulo} className="px-4 py-4 text-center first:pt-0 last:pb-0 sm:py-2">
            <p className="text-3xl font-bold tracking-tight text-folha-900">{metrica.valor}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-600 sm:text-sm">{metrica.rotulo}</p>
          </div>
        ))}
      </div>
      {dados?.alertas_simulados ? (
        <p className="mt-2 text-xs text-gray-600">
          Os números de alertas incluem {numero(dados.alertas_simulados)} registro(s) de demonstração, identificados no mapa.
        </p>
      ) : erro ? (
        <p className="mt-2 text-xs text-gray-600">Os números agregados não estão disponíveis agora.</p>
      ) : null}
    </section>
  )
}
