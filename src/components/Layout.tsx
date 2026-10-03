import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { FRASE_FONTE } from '../lib/fonte'
import { PAINEL_DO_PAPEL, sair, useSessao } from '../lib/sessao'
import logoBloom from '../assets/logo-bloom.png'
import AvisoConexao from './AvisoConexao'
import BarraInferior from './BarraInferior'

const acaoNavbar =
  'flex min-h-10 items-center justify-center rounded-lg border border-folha-200 bg-folha-50 px-3 font-semibold text-folha-800 transition-colors hover:bg-folha-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-folha-600'
const sairNavbar =
  'flex min-h-10 items-center justify-center rounded-lg border border-joaninha-600 bg-joaninha-600 px-3 font-semibold text-white transition-colors hover:border-joaninha-700 hover:bg-joaninha-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-joaninha-600'

// Estrutura comum: cabeçalho, aviso de conexão, conteúdo e rodapé fixo com a fonte dos dados
export default function Layout() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const [menuInicioAberto, setMenuInicioAberto] = useState(false)
  const sessao = useSessao()
  const produtor = sessao.estado === 'produtor'
  const equipe = sessao.estado === 'especialista' || sessao.estado === 'administrador' ? sessao.estado : null
  const primeiroNome = sessao.estado === 'produtor' ? sessao.nome?.split(' ')[0] : null

  // Áreas da equipe (especialista e administração) são para desktop: conteúdo mais largo
  const areaEspecialista = pathname.startsWith('/especialista')
  const areaAdmin = pathname.startsWith('/admin')
  const telaDeLogin =
    pathname === '/produtor/entrar' || pathname === '/especialista/login' || pathname === '/admin/login'
  const painel = (areaEspecialista || areaAdmin) && !telaDeLogin
  const areaProdutor = pathname.startsWith('/produtor') && pathname !== '/produtor/entrar'
  const inicio = pathname === '/'
  const largura = areaEspecialista || areaAdmin || inicio || telaDeLogin || areaProdutor ? 'max-w-7xl' : 'max-w-5xl'
  const larguraNavbar = 'max-w-7xl'

  // Barra inferior do celular: só para conta de produtor, nas telas dele e na inicial
  const mostrarBarra = produtor && (inicio || areaProdutor)
  const chamadaFixa = inicio && sessao.estado === 'deslogado'

  async function sairDaConta() {
    const loginDaArea = areaAdmin ? '/admin/login' : areaEspecialista ? '/especialista/login' : '/produtor/entrar'
    await sair()
    // Na landing, continua na landing; nas áreas, vai para o login correspondente
    navegar(inicio ? '/' : loginDaArea)
  }

  const botaoSair = (
    <button onClick={sairDaConta} className={sairNavbar}>
      Sair
    </button>
  )

  // Lado direito do cabeçalho, conforme a tela e o papel de quem está logado
  let acoes = null
  if (painel) {
    acoes = (
      <>
        <Link to="/" className={acaoNavbar}>
          Ver site público
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && produtor) {
    acoes = (
      <>
        <span className="max-w-28 truncate">Olá, {primeiroNome ?? 'produtor'}</span>
        <Link to="/produtor/chamados" className={`hidden md:flex ${acaoNavbar}`}>
          Meus chamados
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && equipe) {
    acoes = (
      <>
        <Link to={PAINEL_DO_PAPEL[equipe]} className={acaoNavbar}>
          Painel
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && sessao.estado === 'deslogado') {
    acoes = (
      <>
        <Link to="/produtor/entrar" className={`hidden sm:flex ${acaoNavbar}`}>
          Entrar
        </Link>
        <Link
          to="/produtor/entrar?aba=criar"
          className="flex min-h-10 items-center justify-center rounded-lg bg-folha-700 px-4 font-bold text-white transition-colors hover:bg-folha-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-folha-600"
        >
          Começar grátis
        </Link>
      </>
    )
  } else if (areaProdutor && (produtor || equipe)) {
    acoes = (
      <>
        {produtor && <span className="max-w-28 truncate">Olá, {primeiroNome ?? 'produtor'}</span>}
        {botaoSair}
      </>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-folha-100 bg-white text-folha-900">
        <div className={`mx-auto flex ${larguraNavbar} flex-wrap items-center justify-between gap-2 px-4 py-3`}>
          {/* No painel, o logo leva à fila; fora dele (inclusive no login), ao início */}
          <Link
            to={!painel ? '/' : areaAdmin ? '/admin' : '/especialista'}
            className="flex items-center gap-2 whitespace-nowrap text-lg font-bold"
          >
            <img src={logoBloom} alt="Bloom" className="h-10 w-auto" />
            {!telaDeLogin && areaEspecialista && <span className="font-normal">Especialista</span>}
            {!telaDeLogin && areaAdmin && <span className="font-normal">Administração</span>}
          </Link>
          {inicio && (
            <nav
              aria-label="Navegação da página inicial"
              id="menu-inicio"
              className={`${menuInicioAberto ? 'flex' : 'hidden'} order-3 w-full flex-col gap-2 border-t border-folha-100 py-3 text-sm font-semibold lg:order-none lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-7 lg:border-0 lg:py-0`}
            >
              <a href="#mapa-alertas" onClick={() => setMenuInicioAberto(false)} className="py-2 hover:text-folha-700 hover:underline lg:py-0">
                Mapa ao vivo
              </a>
              <a href="#como-funciona" onClick={() => setMenuInicioAberto(false)} className="py-2 hover:text-folha-700 hover:underline lg:py-0">
                Como funciona
              </a>
              <a href="#pragas" onClick={() => setMenuInicioAberto(false)} className="py-2 hover:text-folha-700 hover:underline lg:py-0">
                Culturas
              </a>
              <a href="#alertas" onClick={() => setMenuInicioAberto(false)} className="py-2 hover:text-folha-700 hover:underline lg:py-0">
                Alertas no celular
              </a>
              <Link to="/especialista/login" className="py-2 hover:text-folha-700 hover:underline lg:hidden">
                Acesso do especialista
              </Link>
            </nav>
          )}
          <div className="flex items-center gap-3 text-sm">
            {telaDeLogin && (
              <Link to="/" className={acaoNavbar}>
                Voltar ao início
              </Link>
            )}
            {inicio && (
              <button
                type="button"
                aria-label={menuInicioAberto ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={menuInicioAberto}
                aria-controls="menu-inicio"
                onClick={() => setMenuInicioAberto((aberto) => !aberto)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-folha-200 text-xl lg:hidden"
              >
                {menuInicioAberto ? '×' : '☰'}
              </button>
            )}
            {acoes}
          </div>
        </div>
      </header>

      <AvisoConexao />

      {/* Espaço embaixo para o rodapé fixo (e a barra do celular) não cobrirem o conteúdo */}
      <main
        className={`flex-1 mx-auto w-full ${largura} px-4 ${
          telaDeLogin ? 'py-2 pb-2 sm:py-4 sm:pb-0' : `py-6 ${mostrarBarra || chamadaFixa ? 'pb-36 md:pb-16' : 'pb-16'}`
        }`}
      >
        <Outlet />
      </main>

      <div className="fixed bottom-0 inset-x-0 z-[1000]">
        {mostrarBarra && <BarraInferior />}
        {chamadaFixa && (
          <Link
            to="/produtor/entrar?aba=criar"
            className="flex min-h-14 items-center justify-center bg-folha-600 px-4 font-bold text-white shadow-lg hover:bg-folha-700 md:hidden"
          >
            Criar conta grátis
          </Link>
        )}
        {!telaDeLogin && (
          <footer className="bg-folha-900 px-4 py-2 text-center text-xs text-folha-100">{FRASE_FONTE}</footer>
        )}
      </div>
    </div>
  )
}
