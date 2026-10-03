import { Navigate, Outlet } from 'react-router'
import { sair, usePapel } from '../lib/sessao'
import type { PapelEquipe } from '../lib/sessao'

const TEXTOS: Record<PapelEquipe, { login: string; restrito: string }> = {
  especialista: { login: '/especialista/login', restrito: 'Acesso restrito a especialistas' },
  administrador: { login: '/admin/login', restrito: 'Acesso restrito a administradores' },
}

// Protege as rotas da equipe: exige login e perfis.papel igual ao da área (especialista ou administrador)
export default function RotaEquipe({ papel }: { papel: PapelEquipe }) {
  const acesso = usePapel(papel)

  if (acesso === 'carregando') return <p className="text-center text-gray-600">Carregando...</p>
  if (acesso === 'deslogado') return <Navigate to={TEXTOS[papel].login} replace />
  if (acesso === 'negado') {
    return (
      <div className="mx-auto max-w-sm rounded-xl bg-white p-6 text-center shadow">
        <p className="text-lg font-semibold text-red-800">{TEXTOS[papel].restrito}</p>
        <button className="mt-4 font-semibold text-folha-700 underline" onClick={sair}>
          Entrar com outra conta
        </button>
      </div>
    )
  }
  return <Outlet />
}
