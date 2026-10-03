import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { FRASE_FONTE } from '../lib/fonte'
import { PAINEL_DO_PAPEL, sair, useSessao } from '../lib/sessao'
import AvisoConexao from './AvisoConexao'
import BarraInferior from './BarraInferior'

// Estrutura comum: cabeçalho, aviso de conexão, conteúdo e rodapé fixo com a fonte dos dados
export default function Layout() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const sessao = useSessao()
  const produtor = sessao.estado === 'produtor'
  const equipe = sessao.estado === 'especialista' || sessao.estado === 'administrador' ? sessao.estado : null
  const primeiroNome = sessao.estado === 'produtor' ? sessao.nome?.split(' ')[0] : null

  // Áreas da equipe (especialista e administração) são para desktop: conteúdo mais largo
  const areaEspecialista = pathname.startsWith('/especialista')
  const areaAdmin = pathname.startsWith('/admin')
  const telaDeLogin = pathname === '/especialista/login' || pathname === '/admin/login'
  const painel = (areaEspecialista || areaAdmin) && !telaDeLogin
  const areaProdutor = pathname.startsWith('/produtor') && pathname !== '/produtor/entrar'
  const inicio = pathname === '/'
  const largura = areaEspecialista || areaAdmin ? 'max-w-7xl' : 'max-w-5xl'

  // Barra inferior do celular: só para conta de produtor, nas telas dele e na inicial
  const mostrarBarra = produtor && (inicio || areaProdutor)

  async function sairDaConta() {
    const loginDaArea = areaAdmin ? '/admin/login' : areaEspecialista ? '/especialista/login' : '/produtor/entrar'
    await sair()
    // Na landing, continua na landing; nas áreas, vai para o login correspondente
    navegar(inicio ? '/' : loginDaArea)
  }

  const botaoSair = (
    <button onClick={sairDaConta} className="min-h-10 font-semibold underline">
      Sair
    </button>
  )

  // Lado direito do cabeçalho, conforme a tela e o papel de quem está logado
  let acoes = null
  if (painel) {
    acoes = (
      <>
        <Link to="/" className="font-semibold underline">
          Ver site público
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && produtor) {
    acoes = (
      <>
        <span className="max-w-28 truncate">Olá, {primeiroNome ?? 'produtor'}</span>
        <Link to="/produtor/chamados" className="hidden font-semibold underline md:block">
          Meus chamados
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && equipe) {
    acoes = (
      <>
        <Link to={PAINEL_DO_PAPEL[equipe]} className="font-semibold underline">
          Painel
        </Link>
        {botaoSair}
      </>
    )
  } else if (inicio && sessao.estado === 'deslogado') {
    acoes = (
      <Link
        to="/produtor/entrar"
        className="flex min-h-10 items-center rounded-lg bg-white px-4 font-bold text-folha-800 hover:bg-folha-50"
      >
        Entrar
      </Link>
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
      <header className="bg-folha-700 text-white">
        <div className={`mx-auto flex ${largura} items-center justify-between gap-2 px-4 py-3`}>
          {/* No painel, o logo leva à fila; fora dele (inclusive no login), ao início */}
          <Link to={!painel ? '/' : areaAdmin ? '/admin' : '/especialista'} className="whitespace-nowrap text-lg font-bold">
            🌱 Radar de Pragas{areaEspecialista && <span className="font-normal"> · Especialista</span>}
            {areaAdmin && <span className="font-normal"> · Administração</span>}
          </Link>
          {acoes && <div className="flex items-center gap-3 text-sm">{acoes}</div>}
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
