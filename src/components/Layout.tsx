import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { FRASE_FONTE } from '../lib/fonte'
import { sair, useSessaoProdutor } from '../lib/sessao'

// Estrutura comum: cabeçalho, conteúdo e rodapé fixo com a fonte dos dados
export default function Layout() {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const sessaoProdutor = useSessaoProdutor()

  // Área do especialista é para desktop: conteúdo mais largo e botão de sair
  const areaEspecialista = pathname.startsWith('/especialista')
  const areaProdutor = pathname.startsWith('/produtor') && pathname !== '/produtor/entrar'
  const mostrarSair =
    (areaEspecialista && pathname !== '/especialista/login') || (areaProdutor && sessaoProdutor.estado === 'ok')
  const largura = areaEspecialista ? 'max-w-7xl' : 'max-w-5xl'

  async function sairDaConta() {
    await sair()
    navegar(areaEspecialista ? '/especialista/login' : '/produtor/entrar')
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-folha-700 text-white">
        <div className={`mx-auto flex ${largura} items-center justify-between px-4 py-3`}>
          <Link to={areaEspecialista ? '/especialista' : '/'} className="text-lg font-bold">
            🌱 Radar de Pragas{areaEspecialista && <span className="font-normal"> · Especialista</span>}
          </Link>
          {mostrarSair && (
            <div className="flex items-center gap-2 text-sm">
              {areaProdutor && sessaoProdutor.estado === 'ok' && (
                <span className="max-w-32 truncate">Olá, {sessaoProdutor.nome ?? 'produtor'}</span>
              )}
              <button onClick={sairDaConta} className="min-h-10 font-semibold underline">
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* pb-16 reserva espaço para o rodapé fixo não cobrir o conteúdo */}
      <main className={`flex-1 mx-auto w-full ${largura} px-4 py-6 pb-16`}>
        <Outlet />
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-[1000] bg-folha-900 text-folha-100 text-xs text-center px-4 py-2">
        {FRASE_FONTE}
      </footer>
    </div>
  )
}
