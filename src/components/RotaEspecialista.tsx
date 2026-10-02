import { Navigate, Outlet } from 'react-router'
import { sair, useEspecialista } from '../lib/sessao'

// Protege as rotas do especialista: exige login e perfis.papel = 'especialista'
export default function RotaEspecialista() {
  const acesso = useEspecialista()

  if (acesso === 'carregando') return <p className="text-center text-gray-600">Carregando...</p>
  if (acesso === 'deslogado') return <Navigate to="/especialista/login" replace />
  if (acesso === 'negado') {
    return (
      <div className="mx-auto max-w-sm rounded-xl bg-white p-6 text-center shadow">
        <p className="text-lg font-semibold text-red-800">Acesso restrito a especialistas</p>
        <button className="mt-4 font-semibold text-folha-700 underline" onClick={sair}>
          Entrar com outra conta
        </button>
      </div>
    )
  }
  return <Outlet />
}
