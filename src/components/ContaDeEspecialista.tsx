import { useNavigate } from 'react-router'
import { sair } from '../lib/sessao'
import BotaoGrande from './BotaoGrande'

// Mostrado quando uma conta de especialista tenta usar a área do produtor.
// Uma conta é produtor OU especialista (o banco também recusa chamado de especialista).
export default function ContaDeEspecialista({ rotuloSair = 'Sair' }: { rotuloSair?: string }) {
  const navegar = useNavigate()

  async function sairDaConta() {
    await sair()
    navegar('/produtor/entrar', { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-white p-6 text-center shadow-sm">
      <div className="text-5xl" aria-hidden="true">
        👩‍🌾
      </div>
      <h1 className="text-xl font-bold text-folha-800">Você está conectado como especialista</h1>
      <p className="text-gray-700">
        A área do produtor é só para produtores. Para reportar uma praga, saia e entre com uma conta de produtor.
      </p>
      <BotaoGrande to="/especialista">Ir para o painel</BotaoGrande>
      <BotaoGrande variante="secundario" onClick={sairDaConta}>
        {rotuloSair}
      </BotaoGrande>
    </div>
  )
}
