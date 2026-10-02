import { Suspense, lazy } from 'react'
import { Link } from 'react-router'
import BotaoGrande from '../components/BotaoGrande'
import ComoFunciona from '../components/landing/ComoFunciona'
import Culturas from '../components/landing/Culturas'
import Numeros from '../components/landing/Numeros'
import Telegram from '../components/landing/Telegram'
import { DATA_EXTRACAO_AGROFIT } from '../lib/fonte'
import { useSessaoProdutor } from '../lib/sessao'

// O Leaflet só é baixado quando o mapa aparece (deixa o resto do app leve)
const MapaAlertas = lazy(() => import('../components/MapaAlertas'))

const CONFIANCA = [
  { icone: '👩‍🌾', texto: 'A IA ajuda na triagem, mas quem confirma a praga é sempre um especialista.' },
  { icone: '⚠️', texto: 'O alerta nunca traz dose e sempre orienta procurar a assistência técnica (CATI).' },
  { icone: '📍', texto: 'Sua localização exata não aparece para ninguém: mostramos só o município.' },
  { icone: '📱', texto: 'Seu celular serve só para entrar. O especialista e os alertas não mostram o número.' },
]

// Landing page: tela inicial pública do Radar de Pragas
export default function Inicio() {
  const sessao = useSessaoProdutor()
  const logado = sessao.estado === 'ok'

  return (
    <div className="flex flex-col gap-10 pt-2">
      {/* Abertura */}
      <section className="rounded-3xl bg-gradient-to-br from-folha-600 to-folha-800 px-5 py-8 text-white md:px-10 md:py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-folha-100">Região de Araraquara · SP</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight md:text-5xl">
          Viu uma praga na lavoura?
          <br />
          Um especialista te responde.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-folha-50">
          Mande uma foto pelo celular. A IA faz a triagem com a base oficial do MAPA, um agrônomo confirma e os
          produtores da região recebem o alerta.
        </p>
        <div className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
          {logado ? (
            <>
              <Link
                to="/produtor"
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-5 text-lg font-semibold text-folha-800"
              >
                📷 Reportar praga
              </Link>
              <Link
                to="/produtor/chamados"
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-white px-5 text-lg font-semibold"
              >
                Meus chamados
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/produtor/entrar?aba=criar"
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-5 text-lg font-semibold text-folha-800"
              >
                Criar conta grátis
              </Link>
              <Link
                to="/produtor/entrar"
                className="flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-white px-5 text-lg font-semibold"
              >
                Já tenho conta
              </Link>
            </>
          )}
        </div>
        <p className="mt-4 text-sm text-folha-100">
          É agrônomo ou técnico?{' '}
          <Link to="/especialista/login" className="font-semibold underline">
            Acesso do especialista
          </Link>
        </p>
      </section>

      <Numeros />
      <ComoFunciona />

      {/* Mapa */}
      <section aria-labelledby="titulo-mapa" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 id="titulo-mapa" className="mb-3 text-xl font-bold text-folha-800">
          Alertas na região
        </h2>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-gray-100" />}>
          <MapaAlertas />
        </Suspense>
      </section>

      <Culturas />
      <Telegram />

      {/* Confiança */}
      <section aria-labelledby="titulo-confianca">
        <h2 id="titulo-confianca" className="mb-3 text-xl font-bold text-folha-800">
          Pode confiar
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {CONFIANCA.map((c) => (
            <li key={c.texto} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <span className="text-2xl" aria-hidden="true">
                {c.icone}
              </span>
              <span className="text-gray-800">{c.texto}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Chamada final */}
      {!logado && (
        <section className="mx-auto flex w-full max-w-md flex-col gap-3 text-center">
          <h2 className="text-xl font-bold text-folha-800">Comece agora</h2>
          <BotaoGrande to="/produtor/entrar?aba=criar">Criar conta com meu celular</BotaoGrande>
        </section>
      )}

      {/* Fontes */}
      <section className="border-t border-folha-200 pt-4 text-sm text-gray-600">
        <p>
          Dados de pragas e produtos: <strong>Agrofit/MAPA</strong> (
          <a href="https://dados.agricultura.gov.br/dataset/agrofit" className="underline" target="_blank" rel="noreferrer">
            dados.agricultura.gov.br
          </a>
          ), extraído em {DATA_EXTRACAO_AGROFIT}. Municípios: IBGE. Mapa: © colaboradores do OpenStreetMap.
        </p>
        <p className="mt-1">
          Projeto de hackathon da ConectaTeam ·{' '}
          <a
            href="https://github.com/ViniPeredaOficial/ConectaTeam"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            código aberto no GitHub
          </a>
        </p>
      </section>
    </div>
  )
}
