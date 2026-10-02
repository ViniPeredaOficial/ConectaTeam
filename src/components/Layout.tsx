import { Link, Outlet } from 'react-router'
import { FRASE_FONTE } from '../lib/fonte'

// Estrutura comum: cabeçalho, conteúdo e rodapé fixo com a fonte dos dados
export default function Layout() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-folha-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Link to="/" className="text-lg font-bold">
            🌱 Radar de Pragas
          </Link>
        </div>
      </header>

      {/* pb-16 reserva espaço para o rodapé fixo não cobrir o conteúdo */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-16">
        <Outlet />
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-folha-900 text-folha-100 text-xs text-center px-4 py-2">
        {FRASE_FONTE}
      </footer>
    </div>
  )
}
