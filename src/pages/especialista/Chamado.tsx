import { useParams } from 'react-router'

// Detalhe do chamado: sugestões da IA e confirmação/correção (implementação futura)
export default function Chamado() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="text-2xl font-bold text-folha-800">Chamado {id}</h1>
      <p className="mt-2 text-gray-700">
        Em breve: sugestões da IA e confirmação do especialista.
      </p>
    </div>
  )
}
