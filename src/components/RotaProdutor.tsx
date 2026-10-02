import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessaoProdutor } from '../lib/sessao'

// Protege a área do produtor: sem conta (ou com sessão anônima antiga), vai para o login
// e depois volta para a página em que estava
export default function RotaProdutor() {
  const sessao = useSessaoProdutor()
  const { pathname } = useLocation()

  if (sessao.estado === 'carregando') return <p className="text-center text-gray-600">Carregando...</p>
  if (sessao.estado === 'deslogado') {
    return <Navigate to={`/produtor/entrar?voltar=${encodeURIComponent(pathname)}`} replace />
  }
  return <Outlet />
}
