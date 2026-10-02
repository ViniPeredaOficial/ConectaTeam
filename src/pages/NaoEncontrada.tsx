import BotaoGrande from '../components/BotaoGrande'
import BotaoVoltar from '../components/BotaoVoltar'
import { useTitulo } from '../lib/titulo'

// Página para endereço que não existe, sempre com saída
export default function NaoEncontrada() {
  useTitulo('Página não encontrada')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-10 text-center">
      <div className="text-6xl" aria-hidden="true">
        🌾
      </div>
      <h1 className="text-2xl font-bold text-folha-800">Página não encontrada</h1>
      <p className="text-gray-700">O endereço pode estar errado ou a página mudou de lugar.</p>
      <BotaoGrande to="/">Ir para o início</BotaoGrande>
      <BotaoVoltar para="/" />
    </div>
  )
}
