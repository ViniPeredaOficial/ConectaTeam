import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { FRASE_FONTE } from '../lib/fonte'
import { sair, useSessaoProdutor } from '../lib/sessao'
import AvisoConexao from './AvisoConexao'
import BarraInferior from './BarraInferior'

// Estrutura comum: cabeçalho, aviso de conexão, conteúdo e rodapé fixo com a fonte dos dados
export default function Layout() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const sessaoProdutor = useSessaoProdutor()
  const produtorLogado = sessaoProdutor.estado === 'ok'

  // Área do especialista é para desktop: conteúdo mais largo e botão de sair
  const areaEspecialista = pathname.startsWith('/especialista')
  const loginEspecialista = pathname === '/especialista/login'
  const especialistaLogado = areaEspecialista && !loginEspecialista
  const areaProdutor = pathname.startsWith('/produtor') && pathname !== '/produtor/entrar'
  const mostrarSair = especialistaLogado || (areaProdutor && produtorLogado)
  const largura = areaEspecialista ? 'max-w-7xl' : 'max-w-5xl'

  // Barra inferior do celular: telas do produtor logado (e a inicial, quando ele já entrou)
  const mostrarBarra = produtorLogado && (pathname === '/' || areaProdutor)

  async function sairDaConta() {
    await sair()
    navegar(areaEspecialista ? '/especialista/login' : '/produtor/entrar')
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-folha-700 text-white">
        <div className={`mx-auto flex ${largura} items-center justify-between gap-2 px-4 py-3`}>
          {/* No painel, o logo leva à fila; fora dele (inclusive no login), ao início */}
          <Link to={especialistaLogado ? '/especialista' : '/'} className="whitespace-nowrap text-lg font-bold">
            🌱 Radar de Pragas{areaEspecialista && <span className="font-normal"> · Especialista</span>}
          </Link>
          {mostrarSair && (
            <div className="flex items-center gap-3 text-sm">
              {areaProdutor && produtorLogado && (
                <span className="max-w-28 truncate">Olá, {sessaoProdutor.nome?.split(' ')[0] ?? 'produtor'}</span>
              )}
              {especialistaLogado && (
                <Link to="/" className="font-semibold underline">
                  Ver site público
                </Link>
              )}
              <button onClick={sairDaConta} className="min-h-10 font-semibold underline">
                Sair
              </button>
            </div>
          )}
          {/* Landing: botão de login (ou atalho para quem já entrou) */}
          {pathname === '/' &&
            (produtorLogado ? (
              <Link to="/produtor/chamados" className="hidden text-sm font-semibold underline md:block">
                Meus chamados
              </Link>
            ) : (
              sessaoProdutor.estado === 'deslogado' && (
                <Link
                  to="/produtor/entrar"
                  className="flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-bold text-folha-800 hover:bg-folha-50"
                >
                  Entrar
                </Link>
              )
            ))}
        </div>
      </header>

      <AvisoConexao />

      {/* Espaço embaixo para o rodapé fixo (e a barra do celular) não cobrirem o conteúdo */}
      <main className={`flex-1 mx-auto w-full ${largura} px-4 py-6 ${mostrarBarra ? 'pb-36 md:pb-16' : 'pb-16'}`}>
        <Outlet />
      </main>

      <div className="fixed bottom-0 inset-x-0 z-[1000]">
        {mostrarBarra && <BarraInferior />}
        <footer className="bg-folha-900 px-4 py-2 text-center text-xs text-folha-100">{FRASE_FONTE}</footer>
      </div>
    </div>
  )
}
