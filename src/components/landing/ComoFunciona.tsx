const PASSOS = [
  {
    icone: '📷',
    titulo: 'Você reporta',
    texto: 'Tire uma foto da folha ou do fruto, diga a plantação e o que viu. Leva um minuto.',
  },
  {
    icone: '🤖',
    titulo: 'A IA faz a triagem',
    texto: 'Ela sugere as pragas mais prováveis, só entre as registradas no Agrofit do MAPA para a sua cultura.',
  },
  {
    icone: '👩‍🌾',
    titulo: 'O especialista confirma',
    texto: 'Um agrônomo confere, corrige se preciso e explica como identificar e como manejar.',
  },
  {
    icone: '📣',
    titulo: 'A região fica sabendo',
    texto: 'Sai um alerta no Telegram para os produtores num raio de 15 km, sem expor quem reportou.',
  },
  {
    icone: '✅',
    titulo: 'Você acompanha',
    texto: 'A resposta aparece em "Meus chamados", em qualquer celular em que você entrar.',
  },
]

// Fluxo do sistema em 5 passos
export default function ComoFunciona() {
  return (
    <section aria-labelledby="titulo-como-funciona">
      <h2 id="titulo-como-funciona" className="mb-3 text-xl font-bold text-folha-800">
        Como funciona
      </h2>
      <ol className="grid gap-3 md:grid-cols-5">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm md:flex-col md:gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-folha-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="text-3xl" aria-hidden="true">
                {p.icone}
              </span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{p.titulo}</h3>
              <p className="text-sm text-gray-700">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
