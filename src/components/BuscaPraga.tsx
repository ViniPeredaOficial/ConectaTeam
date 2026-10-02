import { useEffect, useState } from 'react'
import { paraBusca } from '../lib/formato'
import { supabase } from '../lib/supabase'

export type PragaEscolhida = { praga_nome_comum: string | null; praga_nome_cientifico: string }

type Props = {
  cultura: string
  onEscolher: (praga: PragaEscolhida) => void
}

// Autocomplete de pragas do Agrofit, só da cultura do chamado
export default function BuscaPraga({ cultura, onEscolher }: Props) {
  const [termo, setTermo] = useState('')
  const [opcoes, setOpcoes] = useState<PragaEscolhida[]>([])

  // Busca com pequeno atraso para não consultar a cada tecla
  useEffect(() => {
    const busca = paraBusca(termo).replace(/[%_]/g, '')
    const timer = setTimeout(() => {
      if (busca.length < 2) return setOpcoes([])
      supabase
        .from('agrofit_pragas')
        .select('praga_nome_comum, praga_nome_cientifico')
        .eq('cultura_busca', paraBusca(cultura))
        .ilike('praga_busca', `%${busca}%`)
        .order('praga_nome_cientifico')
        .limit(8)
        .then(({ data }) => setOpcoes(data ?? []))
    }, 250)
    return () => clearTimeout(timer)
  }, [termo, cultura])

  function escolher(p: PragaEscolhida) {
    onEscolher(p)
    setTermo('')
    setOpcoes([])
  }

  return (
    <div className="relative">
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={`Buscar outra praga de ${cultura} no Agrofit (nome comum ou científico)`}
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-folha-500 focus:outline-none"
      />
      {opcoes.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow-lg">
          {opcoes.map((p) => (
            <li key={p.praga_nome_cientifico}>
              <button
                type="button"
                onClick={() => escolher(p)}
                className="w-full px-3 py-2 text-left hover:bg-folha-50"
              >
                <span className="font-semibold">{p.praga_nome_comum ?? '(sem nome comum)'}</span>{' '}
                <span className="text-sm italic text-gray-600">{p.praga_nome_cientifico}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
