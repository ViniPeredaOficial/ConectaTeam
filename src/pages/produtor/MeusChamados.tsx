import BotaoGrande from '../../components/BotaoGrande'

// Lista de chamados enviados pelo produtor (implementação futura)
export default function MeusChamados() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold text-folha-800">Meus chamados</h1>
      <p className="text-gray-700">Nenhum chamado ainda.</p>
      <BotaoGrande to="/produtor">Reportar nova praga</BotaoGrande>
    </div>
  )
}
