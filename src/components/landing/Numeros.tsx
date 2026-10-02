import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Totais públicos (função estatisticas_publicas: só números agregados, nada pessoal)
type Estatisticas = {
  chamados: number
  chamados_simulados: number
  analisados: number
  analisados_simulados: number
  alertas: number
  alertas_simulados: number
  municipios_com_alerta: number
  horas_ate_resposta: number | null
  acerto_ia: number | null
  respostas_com_ia: number
}

const numero = (n: number) => n.toLocaleString('pt-BR')

function horas(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

// Números ao vivo do sistema, com aviso quando incluem dados de demonstração (regra 7)
export default function Numeros() {
  const [dados, setDados] = useState<Estatisticas | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    supabase
      .rpc('estatisticas_publicas')
      .then(({ data, error }) => (error ? setErro(true) : setDados(data as Estatisticas)))
  }, [])

  if (erro) return null

  const cartoes = [
    { rotulo: 'chamados recebidos', valor: dados && numero(dados.chamados), simulados: dados?.chamados_simulados },
    { rotulo: 'analisados por especialista', valor: dados && numero(dados.analisados), simulados: dados?.analisados_simulados },
    { rotulo: 'alertas regionais', valor: dados && numero(dados.alertas), simulados: dados?.alertas_simulados },
    { rotulo: 'municípios com alerta', valor: dados && numero(dados.municipios_com_alerta) },
    { rotulo: 'tempo médio até a resposta', valor: dados && horas(dados.horas_ate_resposta) },
    {
      rotulo: 'acerto da IA na 1ª sugestão',
      valor: dados && (dados.acerto_ia === null ? '—' : `${Math.round(dados.acerto_ia * 100)}%`),
    },
  ]
  const temSimulado = Boolean(dados && dados.chamados_simulados > 0)

  return (
    <section aria-labelledby="titulo-numeros">
      <h2 id="titulo-numeros" className="mb-3 text-xl font-bold text-folha-800">
        O Radar em números
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-3xl font-bold text-folha-700">{c.valor ?? '…'}</p>
            <p className="text-sm text-gray-700">{c.rotulo}</p>
            {Boolean(c.simulados) && (
              <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 text-xs font-semibold text-purple-800">
                {c.simulados} simulados
              </span>
            )}
          </div>
        ))}
      </div>
      {temSimulado && (
        <p className="mt-2 text-sm text-gray-600">
          Inclui dados <strong>simulados</strong> de demonstração da região de Araraquara, marcados em todo o sistema.
        </p>
      )}
    </section>
  )
}
