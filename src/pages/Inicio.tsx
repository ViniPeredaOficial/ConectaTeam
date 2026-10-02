import { Suspense, lazy } from 'react'
import BotaoGrande from '../components/BotaoGrande'

// O Leaflet só é baixado quando o mapa aparece (deixa o resto do app leve)
const MapaAlertas = lazy(() => import('../components/MapaAlertas'))

// Tela inicial: escolha do tipo de usuário e mapa público de alertas da região
export default function Inicio() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pt-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="text-center text-2xl font-bold text-folha-800">Viu uma praga na lavoura?</h1>
        <p className="text-center text-gray-700">Mande uma foto e receba a orientação de um especialista.</p>
        <BotaoGrande to="/produtor">Sou produtor</BotaoGrande>
        <BotaoGrande to="/especialista/login" variante="secundario">
          Sou especialista
        </BotaoGrande>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-folha-800">Alertas na região de Araraquara</h2>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-gray-100" />}>
          <MapaAlertas />
        </Suspense>
      </section>
    </div>
  )
}
