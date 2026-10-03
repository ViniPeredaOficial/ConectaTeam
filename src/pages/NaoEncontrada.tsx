import BotaoGrande from '../components/BotaoGrande'
import { useTitulo } from '../lib/titulo'

// Página para endereço que não existe, sempre com saída
export default function NaoEncontrada() {
  useTitulo('Página não encontrada')
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center sm:py-14">
      <section className="w-full rounded-3xl border border-folha-200 bg-white p-6 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-folha-700">Erro 404</p>
        <div className="mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-folha-50 text-3xl text-folha-700" aria-hidden="true">
          !
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-folha-900 sm:text-4xl">Página não encontrada</h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-gray-600">
          O endereço pode estar errado ou a página mudou de lugar. Volte ao início para continuar explorando o Radar.
        </p>
        <div className="mx-auto mt-6 max-w-sm">
          <BotaoGrande to="/">Ir para o início</BotaoGrande>
        </div>
      </section>
    </div>
  )
}
