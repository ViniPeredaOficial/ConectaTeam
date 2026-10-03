import { useNavigate } from 'react-router'
import { PAINEL_DO_PAPEL, sair } from '../lib/sessao'
import type { PapelEquipe } from '../lib/sessao'
import BotaoGrande from './BotaoGrande'

const NOME: Record<PapelEquipe, string> = { especialista: 'especialista', administrador: 'administrador' }

// Mostrado quando uma conta da equipe (especialista ou administrador) tenta usar a área do produtor.
// Uma conta tem um papel só (o banco também recusa chamado dessas contas).
export default function ContaDaEquipe({ papel, rotuloSair = 'Sair' }: { papel: PapelEquipe; rotuloSair?: string }) {
  const navegar = useNavigate()

  async function sairDaConta() {
    await sair()
    navegar('/produtor/entrar', { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-white p-6 text-center shadow-sm">
      <div className="text-5xl" aria-hidden="true">
        {papel === 'administrador' ? '🗂️' : '👩‍🌾'}
      </div>
      <h1 className="text-xl font-bold text-folha-800">Você está conectado como {NOME[papel]}</h1>
      <p className="text-gray-700">
        A área do produtor é só para produtores. Para reportar uma praga, saia e entre com uma conta de produtor.
      </p>
      <BotaoGrande to={PAINEL_DO_PAPEL[papel]}>Ir para o painel</BotaoGrande>
      <BotaoGrande variante="secundario" onClick={sairDaConta}>
        {rotuloSair}
      </BotaoGrande>
    </div>
  )
}
