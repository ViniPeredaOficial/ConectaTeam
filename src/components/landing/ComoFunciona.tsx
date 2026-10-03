const PASSOS = [
  {
    titulo: 'Você reporta',
    texto: 'Tire uma foto da folha ou do fruto, diga a plantação e o que viu. Leva um minuto.',
  },
  {
    titulo: 'A IA faz a triagem',
    texto: 'Ela sugere as pragas mais prováveis, só entre as registradas no Agrofit do MAPA para a sua cultura.',
  },
  {
    titulo: 'O especialista confirma',
    texto: 'Um agrônomo confere, corrige se preciso e explica como identificar e manejar a praga.',
  },
  {
    titulo: 'A região fica sabendo',
    texto: 'Sai um alerta no Telegram para os produtores num raio de 15 km, sem expor quem reportou.',
  },
  {
    titulo: 'Você acompanha',
    texto: 'A resposta aparece em “Meus chamados”, em qualquer celular em que você entrar.',
  },
]

export default function ComoFunciona() {
  return (
    <div>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="rounded-2xl border border-folha-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-folha-100 text-sm font-bold text-folha-800">
                <span className="sr-only">Etapa </span>
                {i + 1}
              </div>
              <div>
                <h3 className="text-base font-bold leading-6 text-folha-900">{p.titulo}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{p.texto}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
