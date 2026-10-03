import { Suspense, lazy, useEffect, useState } from 'react'
import { Link } from 'react-router'
import BotaoGrande from '../components/BotaoGrande'
import ComoFunciona from '../components/landing/ComoFunciona'
import Numeros from '../components/landing/Numeros'
import RiscoRegiao from '../components/landing/RiscoRegiao'
import Telegram from '../components/landing/Telegram'
import { DATA_EXTRACAO_AGROFIT } from '../lib/fonte'
import { coordenadaEmSaoPaulo, pegarLocalizacao } from '../lib/geo'
import { PAINEL_DO_PAPEL, useSessao } from '../lib/sessao'
import { useTitulo } from '../lib/titulo'

const MapaAlertas = lazy(() => import('../components/MapaAlertas'))
const CENTRO_ARARAQUARA: [number, number] = [-21.7845, -48.178]

function GloboIndisponivel() {
  return (
    <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#071522] p-6 text-center text-white">
      <p className="text-lg font-bold">O globo não conseguiu carregar.</p>
      <p className="max-w-xs text-sm text-white/75">
        Confira sua conexão e tente recarregar a página. O restante do Radar continua disponível.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 rounded-lg bg-white px-4 font-semibold text-folha-900 hover:bg-folha-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Recarregar página
      </button>
    </div>
  )
}

const GloboSatelite = lazy(() =>
  import('../components/landing/GloboSatelite').catch((erro: unknown) => {
    console.error('Falha ao importar o globo de satélite', erro)
    return { default: GloboIndisponivel }
  }),
)

const PERGUNTAS = [
  {
    pergunta: 'A IA decide sozinha?',
    resposta:
      'Não. A IA só ajuda na triagem. Um agrônomo ou especialista analisa o caso e confirma a praga antes de publicar um alerta regional.',
  },
  {
    pergunta: 'Meu ponto exato aparece no mapa?',
    resposta:
      'Não. Os alertas são posicionados no centro do município. A localização exata do produtor não é mostrada no mapa.',
  },
  {
    pergunta: 'Meu número de celular fica público?',
    resposta:
      'Não. O telefone é usado para entrar na sua conta e não aparece para especialistas nem nos alertas públicos.',
  },
  {
    pergunta: 'Funciona com internet fraca?',
    resposta:
      'A página é leve e funciona no celular, mas enviar uma foto e receber a análise exige conexão. Se o sinal cair, aguarde a conexão voltar antes de enviar.',
  },
]

export default function Inicio() {
  useTitulo()
  const sessao = useSessao()
  const [centroMapa, setCentroMapa] = useState<[number, number]>(CENTRO_ARARAQUARA)
  const produtor = sessao.estado === 'produtor'
  const equipe = sessao.estado === 'especialista' || sessao.estado === 'administrador' ? sessao.estado : null
  const destinoPrincipal = equipe
    ? PAINEL_DO_PAPEL[equipe]
    : produtor
      ? '/produtor'
      : '/produtor/entrar?aba=criar'
  const textoPrincipal = equipe ? 'Acessar painel' : produtor ? 'Reportar uma ocorrência' : 'Criar conta grátis'

  useEffect(() => {
    let ativo = true
    void pegarLocalizacao().then(
      ({ coords }) => {
        if (ativo && coordenadaEmSaoPaulo(coords.latitude, coords.longitude)) {
          setCentroMapa([coords.latitude, coords.longitude])
        }
      },
      () => {
        // Permissão negada, GPS indisponível ou falha: Araraquara continua como centro padrão.
      },
    )
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-0">
      <section id="hero" className="scroll-mt-6 pb-10 pt-2 sm:pb-12 lg:pb-14">
        <div className="grid items-center gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
          <div className="relative z-10 py-4 lg:py-8">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-folha-700 sm:text-sm">
              Radar de pragas · informação para prevenir
            </p>
            <h1 className="max-w-2xl text-[clamp(2.5rem,5.2vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-folha-900">
              Saiba onde a praga está antes que ela chegue à sua lavoura.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
              Acompanhe ocorrências confirmadas por especialistas, veja o risco da região e receba alertas para agir a
              tempo.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to={destinoPrincipal}
                className="flex min-h-12 items-center justify-center rounded-xl bg-folha-800 px-5 text-center font-bold text-white shadow-sm hover:bg-folha-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-folha-500"
              >
                {textoPrincipal}
              </Link>
              <a
                href="#mapa-alertas"
                className="flex min-h-12 items-center justify-center rounded-xl border-2 border-folha-800 px-5 text-center font-semibold text-folha-900 hover:bg-folha-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-folha-500"
              >
                Explorar o mapa
              </a>
            </div>
            {!produtor && !equipe && (
              <p className="mt-3 text-sm leading-6 text-gray-500">
                É agrônomo ou técnico?{' '}
                <Link to="/especialista/login" className="font-semibold text-folha-800 underline underline-offset-2">
                  Acesse a área do especialista.
                </Link>
              </p>
            )}
          </div>

          <div className="relative min-h-[340px] overflow-hidden bg-transparent sm:min-h-[460px] lg:min-h-[560px]">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-transparent text-sm font-semibold text-gray-500">
                  Carregando o globo…
                </div>
              }
            >
              <GloboSatelite />
            </Suspense>
          </div>
        </div>
      </section>

      <section aria-label="Números do Radar" className="py-7 sm:py-9">
        <Numeros />
      </section>

      <section
        id="mapa-alertas"
        aria-labelledby="titulo-mapa"
        className="scroll-mt-6 py-12 sm:py-16"
      >
        <div className="rounded-2xl border border-folha-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-folha-700">Explore sua região</p>
              <h2 id="titulo-mapa" className="mt-1 text-3xl font-bold leading-tight tracking-tight text-folha-900 sm:text-4xl">
                Mapa de alertas publicados
              </h2>
            </div>
            <p className="text-sm leading-6 text-gray-500">Filtre por cultura e período · atualização automática</p>
          </div>
          <div className="overflow-hidden rounded-xl">
            <Suspense fallback={<div className="h-[420px] animate-pulse rounded-xl bg-gray-100" />}>
              <MapaAlertas altura="h-[420px]" centroInicial={centroMapa} />
            </Suspense>
          </div>
        </div>
      </section>

      <section id="como-funciona" aria-labelledby="titulo-fluxo" className="scroll-mt-6 py-12 sm:py-16">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-folha-700">Prevenção que começa com informação</p>
          <h2 id="titulo-fluxo" className="mt-2 text-3xl font-bold leading-tight tracking-tight text-folha-900 sm:text-4xl">
            Como funciona
          </h2>
        </div>
        <ComoFunciona />
      </section>

      <section id="pragas" className="scroll-mt-6 py-12 sm:py-16">
        <RiscoRegiao />
      </section>

      <section id="alertas" className="scroll-mt-6 py-12 sm:py-16">
        <Telegram />
      </section>

      <section aria-labelledby="titulo-perguntas" className="py-12 sm:py-16">
        <div className="mx-auto mb-6 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-folha-700">Transparência e privacidade</p>
          <h2 id="titulo-perguntas" className="mt-2 text-3xl font-bold leading-tight tracking-tight text-folha-900 sm:text-4xl">
            Perguntas frequentes
          </h2>
        </div>
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-2">
          {PERGUNTAS.map((item) => (
            <details
              key={item.pergunta}
              className="group rounded-2xl border border-folha-200 bg-white p-5 transition-colors open:bg-folha-50/70"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold leading-6 text-folha-900 marker:content-none focus-visible:rounded focus-visible:outline-2 focus-visible:outline-folha-600">
                <span>{item.pergunta}</span>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-folha-100 text-xl text-folha-700 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 border-t border-folha-200 pt-3 text-base leading-7 text-gray-600">{item.resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {sessao.estado === 'deslogado' && (
        <section id="cta-final" className="py-12 sm:py-16">
          <div className="rounded-3xl border border-folha-200 bg-folha-100/70 px-5 py-10 text-center sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-folha-700">Comece gratuitamente</p>
            <h2 className="mx-auto mt-2 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-folha-900 sm:text-4xl">
              Receba informação para se antecipar às pragas da sua região.
            </h2>
            <p className="mt-3 text-base leading-7 text-gray-600">Crie sua conta e acompanhe os alertas do Radar de Pragas.</p>
            <div className="mx-auto mt-5 max-w-sm">
              <BotaoGrande to="/produtor/entrar?aba=criar">Criar conta grátis</BotaoGrande>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Fontes dos dados" className="py-7 sm:py-9">
        <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
          Dados e mapas de fontes identificadas
        </p>
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
          {[
            ['Agrofit / MAPA', 'Pragas e produtos registrados'],
            ['IBGE', 'Códigos e centros dos municípios'],
            ['OpenStreetMap', 'Base cartográfica do mapa'],
            ['Agrônomos', 'Revisão e confirmação dos alertas'],
          ].map(([nome, descricao]) => (
            <div key={nome} className="px-3 text-center first:pl-0 sm:first:pl-3">
              <p className="font-bold text-folha-900">{nome}</p>
              <p className="mt-1 text-xs text-gray-500">{descricao}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-7 text-sm leading-6 text-gray-600">
        <p>
          Fontes: dados de pragas e produtos do <strong>Agrofit/MAPA</strong> (
          <a
            href="https://dados.agricultura.gov.br/dataset/agrofit"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            dados.agricultura.gov.br
          </a>
          ), extraídos em {DATA_EXTRACAO_AGROFIT}; municípios: IBGE; mapas: © colaboradores do OpenStreetMap.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/especialista/login" className="font-semibold underline underline-offset-2">
            Acesso do especialista
          </Link>
          <a
            href="https://github.com/ViniPeredaOficial/ConectaTeam"
            className="font-semibold underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Código aberto no GitHub
          </a>
          <a href="https://www.ibge.gov.br/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
            IBGE
          </a>
          <a
            href="https://www.openstreetmap.org/copyright"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            OpenStreetMap
          </a>
        </div>
        <p className="mt-3">Projeto de hackathon da ConectaTeam.</p>
      </footer>
    </div>
  )
}
