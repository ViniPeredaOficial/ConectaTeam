import BotaoGrande from '../../components/BotaoGrande'

// Formulário para o produtor reportar uma praga (implementação na próxima tarefa)
export default function NovoChamado() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold text-folha-800">Reportar praga</h1>
      <p className="text-gray-700">Em breve: foto, cultura, descrição e localização.</p>
      <BotaoGrande to="/produtor/chamados" variante="secundario">
        Ver meus chamados
      </BotaoGrande>
    </div>
  )
}
