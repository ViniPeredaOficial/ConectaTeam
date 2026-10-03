import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import GerenciarEspecialistas from '../../components/admin/GerenciarEspecialistas'
import GraficoDiario from '../../components/admin/GraficoDiario'
import type { PontoDiario } from '../../components/admin/GraficoDiario'
import GraficoPragas from '../../components/admin/GraficoPragas'
import type { PragaResumo } from '../../components/admin/GraficoPragas'
import { iconeDaCultura } from '../../lib/culturas'
import { supabase } from '../../lib/supabase'
import { useTitulo } from '../../lib/titulo'

const MapaAlertas = lazy(() => import('../../components/MapaAlertas'))

// O que a função painel_admin devolve (só números agregados)
type DadosPainel = {
  usuarios: { produtores: number; especialistas: number; especialistas_bloqueados: number; administradores: number; novos_produtores_mes: number }
  chamados: { total: number; em_analise: number; analisados: number; descartados: number; simulados: number; hoje: number; semana: number; mes: number }
  alertas: { total: number; simulados: number; hoje: number; semana: number; mes: number; municipios: number; pragas: number }
  acerto_ia: number | null
  respostas_com_ia: number
  horas_ate_resposta: number | null
  por_dia: PontoDiario[]
  pragas: PragaResumo[]
  municipios: { municipio: string; praga: string; alertas: number; ultimo: string }[]
  culturas: { cultura: string; chamados: number }[]
}

function horas(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

// Painel da administração: visão geral (dashboard executivo) e cadastro de especialistas
export default function Painel() {
  useTitulo('Administração')
  const [parametros, setParametros] = useSearchParams()
  const aba = parametros.get('aba') === 'especialistas' ? 'especialistas' : 'visao'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 self-start rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {(
          [
            ['visao', 'Visão geral'],
            ['especialistas', 'Especialistas'],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setParametros(valor === 'especialistas' ? { aba: 'especialistas' } : {})}
            className={`rounded-lg px-4 py-2 text-lg font-bold ${
              aba === valor ? 'bg-folha-600 text-white' : 'text-folha-800 hover:bg-folha-50'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'visao' ? <VisaoGeral /> : <GerenciarEspecialistas />}
    </div>
  )
}

function VisaoGeral() {
  const [incluirSimulados, setIncluirSimulados] = useState(true)
  const [dados, setDados] = useState<DadosPainel | null>(null)
  const [erro, setErro] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)

  const carregar = useCallback(() => {
    supabase.rpc('painel_admin', { incluir_simulados: incluirSimulados }).then(({ data, error }) => {
      if (error) return setErro(true)
      setDados(data as DadosPainel)
      setErro(false)
      setAtualizadoEm(new Date())
    })
  }, [incluirSimulados])

  useEffect(carregar, [carregar])

  if (erro) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-800">
        Não conseguimos carregar o painel.{' '}
        <button className="font-semibold underline" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    )
  }
  if (!dados) return <p className="text-gray-600">Carregando o painel...</p>

  const { usuarios, chamados, alertas } = dados

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho e filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-folha-800">Painel executivo</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={incluirSimulados}
              onChange={(e) => setIncluirSimulados(e.target.checked)}
              className="h-5 w-5 accent-folha-600"
            />
            Incluir dados simulados
          </label>
          <span className="text-gray-500">
            Atualizado às {atualizadoEm?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={carregar} className="font-semibold text-folha-700 underline">
            Atualizar
          </button>
        </div>
      </div>
      {incluirSimulados && (chamados.simulados > 0 || alertas.simulados > 0) && (
        <p className="rounded-lg bg-purple-50 p-3 text-sm text-purple-900">
          Os números incluem dados <strong>simulados</strong> de demonstração: {chamados.simulados} chamados e{' '}
          {alertas.simulados} alertas. Desmarque "Incluir dados simulados" para ver só os dados reais.
        </p>
      )}

      {/* Alertas: hoje, semana, mês */}
      <section aria-labelledby="titulo-alertas">
        <h2 id="titulo-alertas" className="mb-2 text-lg font-bold text-folha-800">
          Alertas regionais
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Indicador rotulo="Hoje" valor={alertas.hoje} />
          <Indicador rotulo="Últimos 7 dias" valor={alertas.semana} />
          <Indicador rotulo="Últimos 30 dias" valor={alertas.mes} />
          <Indicador rotulo="Municípios afetados" valor={alertas.municipios} />
          <Indicador rotulo="Pragas diferentes" valor={alertas.pragas} />
        </div>
      </section>

      {/* Chamados, qualidade e usuários */}
      <section className="grid gap-3 lg:grid-cols-3">
        <Bloco titulo="Chamados">
          <Linha rotulo="Total" valor={chamados.total} />
          <Linha rotulo="Em análise agora" valor={chamados.em_analise} destaque={chamados.em_analise > 0} />
          <Linha rotulo="Analisados" valor={chamados.analisados} />
          <Linha rotulo="Descartados" valor={chamados.descartados} />
          <Linha rotulo="Hoje · 7 dias · 30 dias" valor={`${chamados.hoje} · ${chamados.semana} · ${chamados.mes}`} />
        </Bloco>
        <Bloco titulo="Qualidade do atendimento">
          <Linha
            rotulo="Acerto da IA na 1ª sugestão"
            valor={dados.acerto_ia === null ? '—' : `${Math.round(dados.acerto_ia * 100)}%`}
          />
          <Linha rotulo="Respostas em que a IA opinou" valor={dados.respostas_com_ia} />
          <Linha rotulo="Tempo médio até a resposta" valor={horas(dados.horas_ate_resposta)} />
        </Bloco>
        <Bloco titulo="Usuários">
          <Linha rotulo="Produtores" valor={usuarios.produtores} />
          <Linha rotulo="Novos produtores (30 dias)" valor={usuarios.novos_produtores_mes} />
          <Linha
            rotulo="Especialistas ativos"
            valor={usuarios.especialistas - usuarios.especialistas_bloqueados}
          />
          <Linha rotulo="Especialistas bloqueados" valor={usuarios.especialistas_bloqueados} />
          <Linha rotulo="Administradores" valor={usuarios.administradores} />
        </Bloco>
      </section>

      {/* Série diária */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-folha-800">Chamados e alertas por dia</h2>
        <p className="mb-3 text-sm text-gray-600">Últimos 30 dias. Passe o mouse para ver os números de cada dia.</p>
        <GraficoDiario pontos={dados.por_dia} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pragas */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-folha-800">Pragas com mais alertas</h2>
          <p className="mb-4 text-sm text-gray-600">Número de alertas regionais por praga.</p>
          <GraficoPragas pragas={dados.pragas} />
        </section>

        {/* Municípios × pragas */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-folha-800">Municípios afetados</h2>
          <p className="mb-3 text-sm text-gray-600">Alertas por município e praga, do maior para o menor.</p>
          {dados.municipios.length === 0 ? (
            <p className="text-gray-600">Nenhum alerta no período.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-gray-600">
                    <th className="py-2">Município</th>
                    <th className="py-2">Praga</th>
                    <th className="py-2 text-right">Alertas</th>
                    <th className="py-2 text-right">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.municipios.map((m) => (
                    <tr key={`${m.municipio}-${m.praga}`} className="border-t border-gray-100">
                      <td className="py-2 font-semibold text-gray-900">{m.municipio}</td>
                      <td className="py-2 text-gray-700">{m.praga}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{m.alertas}</td>
                      <td className="py-2 text-right text-gray-700">{new Date(m.ultimo).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Culturas */}
      {dados.culturas.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-folha-800">Chamados por cultura</h2>
          <ul className="flex flex-wrap gap-3">
            {dados.culturas.map((c) => (
              <li key={c.cultura} className="rounded-xl bg-folha-50 px-4 py-2">
                <span className="mr-2" aria-hidden="true">
                  {iconeDaCultura(c.cultura)}
                </span>
                <strong className="text-gray-900">{c.chamados}</strong> <span className="text-gray-700">{c.cultura}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Mapa */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-folha-800">Mapa de alertas</h2>
        <Suspense fallback={<div className="h-[480px] animate-pulse rounded-xl bg-gray-100" />}>
          <MapaAlertas altura="h-[480px]" rolagem />
        </Suspense>
      </section>
    </div>
  )
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-4xl font-bold text-folha-800">{valor.toLocaleString('pt-BR')}</p>
      <p className="text-sm text-gray-600">{rotulo}</p>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-lg font-bold text-folha-800">{titulo}</h2>
      <dl className="flex flex-col">{children}</dl>
    </div>
  )
}

function Linha({ rotulo, valor, destaque = false }: { rotulo: string; valor: number | string; destaque?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-gray-100 py-2 first:border-t-0">
      <dt className="text-sm text-gray-700">{rotulo}</dt>
      <dd className={`font-bold ${destaque ? 'text-amber-800' : 'text-gray-900'}`}>
        {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
      </dd>
    </div>
  )
}
