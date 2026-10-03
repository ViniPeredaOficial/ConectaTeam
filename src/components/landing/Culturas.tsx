import { useEffect, useState } from 'react'
import { iconeDaCultura } from '../../lib/culturas'
import { supabase } from '../../lib/supabase'

type Cultura = {
  cultura: string
  pragas: number
  produtos: number
  produtos_biologicos: number
  principais_pragas: string[] | null
}

const primeiraMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// Culturas monitoradas, com números da base oficial Agrofit (função culturas_monitoradas)
export default function Culturas() {
  const [culturas, setCulturas] = useState<Cultura[] | null>(null)

  useEffect(() => {
    supabase.rpc('culturas_monitoradas').then(({ data }) => setCulturas((data as Cultura[]) ?? []))
  }, [])

  if (culturas?.length === 0) return null

  return (
    <section aria-labelledby="titulo-culturas">
      <h3 id="titulo-culturas" className="mb-1 text-lg font-bold text-folha-800">
        Culturas monitoradas
      </h3>
      <p className="mb-3 text-sm text-gray-700">
        Pragas e produtos registrados para cada cultura na base oficial Agrofit do MAPA.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {(culturas ?? []).map((c) => (
          <article key={c.cultura} className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <span className="text-3xl" aria-hidden="true">
                {iconeDaCultura(c.cultura)}
              </span>
              {c.cultura}
            </h3>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-gray-600">pragas</dt>
                <dd className="text-xl font-bold text-folha-700">{c.pragas}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">produtos</dt>
                <dd className="text-xl font-bold text-folha-700">{c.produtos.toLocaleString('pt-BR')}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-600">biológicos</dt>
                <dd className="text-xl font-bold text-folha-700">{c.produtos_biologicos.toLocaleString('pt-BR')}</dd>
              </div>
            </dl>
            {c.principais_pragas && (
              <p className="mt-3 text-sm text-gray-700">
                <span className="font-semibold">Mais comuns no registro:</span>{' '}
                {c.principais_pragas.map(primeiraMaiuscula).join(', ')}
              </p>
            )}
          </article>
        ))}
        {!culturas &&
          [1, 2, 3].map((n) => <div key={n} className="h-40 animate-pulse rounded-2xl bg-white/60" />)}
      </div>
    </section>
  )
}
