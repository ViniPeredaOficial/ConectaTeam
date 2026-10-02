const DICAS = [
  { icone: '📏', texto: 'Chegue perto: a folha ou o fruto doente deve ocupar quase toda a foto.' },
  { icone: '☀️', texto: 'Use a luz do dia, sem flash e sem sombra em cima do problema.' },
  { icone: '🎯', texto: 'Mostre o sintoma mais claro (mancha, furo, inseto, mofo). Se puder, vire a folha.' },
  { icone: '🙈', texto: 'Não fotografe pessoas, placas de carro ou documentos.' },
]

// "Como tirar uma boa foto?" no passo 1 do produtor (foto melhor = resposta melhor da IA)
export default function DicasFoto() {
  return (
    <details className="mt-2 rounded-xl bg-folha-50 p-3">
      <summary className="cursor-pointer font-semibold text-folha-800">Como tirar uma boa foto?</summary>
      <ul className="mt-2 space-y-2">
        {DICAS.map((d) => (
          <li key={d.texto} className="flex gap-2 text-sm text-gray-800">
            <span aria-hidden="true">{d.icone}</span>
            {d.texto}
          </li>
        ))}
      </ul>
    </details>
  )
}
