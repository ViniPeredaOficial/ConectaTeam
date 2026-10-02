import { useEffect, useState } from 'react'
import type { Local } from '../../lib/clima'
import { distanciaKm } from '../../lib/geo'
import { supabase } from '../../lib/supabase'
import RiscoClima from '../RiscoClima'

// Mesma região do bot do Telegram: até 40 km de Araraquara
const CENTRO = { lat: -21.7845, lon: -48.178 }
const RAIO_KM = 40

async function municipiosDaRegiao(): Promise<Local[]> {
  const { data, error } = await supabase.from('municipios').select('cod_ibge, nome, lat, lon')
  if (error) throw error
  return data
    .filter((m) => distanciaKm(CENTRO.lat, CENTRO.lon, m.lat, m.lon) <= RAIO_KM)
    .map((m) => ({ cod: m.cod_ibge, nome: m.nome, lat: m.lat, lon: m.lon }))
}

// Seção da landing: risco climático dos próximos 3 dias nos municípios da região
export default function RiscoRegiao() {
  const [locais, setLocais] = useState<Local[]>([])

  useEffect(() => {
    municipiosDaRegiao()
      .then(setLocais)
      .catch((e) => console.error('Falha ao carregar municípios', e))
  }, [])

  return (
    <section aria-labelledby="titulo-risco">
      <h2 id="titulo-risco" className="mb-1 text-xl font-bold text-folha-800">
        Risco da semana na região
      </h2>
      <p className="mb-3 text-sm text-gray-700">
        Como o tempo dos próximos 3 dias favorece doenças e pragas em cada município. Os de maior risco aparecem
        primeiro.
      </p>
      <RiscoClima locais={locais} />
    </section>
  )
}
