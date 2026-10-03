import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessao } from '../lib/sessao'
import ContaDaEquipe from './ContaDaEquipe'

// Protege a área do produtor: só conta de produtor entra.
// Sem conta (ou sessão anônima antiga) vai para o login e depois volta para a página em que estava;
// conta da equipe (especialista ou administrador) vê o aviso de que esta área não é para ela.
export default function RotaProdutor() {
  const sessao = useSessao()
  const { pathname } = useLocation()

  if (sessao.estado === 'carregando') return <p className="text-center text-gray-600">Carregando...</p>
  if (sessao.estado === 'deslogado') {
    return <Navigate to={`/produtor/entrar?voltar=${encodeURIComponent(pathname)}`} replace />
  }
  if (sessao.estado === 'especialista' || sessao.estado === 'administrador') return <ContaDaEquipe papel={sessao.estado} />
  return <Outlet />
}
