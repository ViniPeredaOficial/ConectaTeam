import BotaoGrande from '../components/BotaoGrande'

// Tela inicial: escolha do tipo de usuário
export default function Inicio() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-8">
      <h1 className="text-center text-2xl font-bold text-folha-800">Viu uma praga na lavoura?</h1>
      <p className="text-center text-gray-700">
        Mande uma foto e receba a orientação de um especialista.
      </p>
      <BotaoGrande to="/produtor">Sou produtor</BotaoGrande>
      <BotaoGrande to="/especialista/login" variante="secundario">
        Sou especialista
      </BotaoGrande>
    </div>
  )
}
