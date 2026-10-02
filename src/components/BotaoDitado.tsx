import { useEffect, useRef, useState } from 'react'
import { escolherAlternativa, removerRepeticoes } from '../lib/fala'

// Tipos mínimos da Web Speech API (não fazem parte do TypeScript padrão)
type Alternativa = { transcript: string }
type ResultadoFala = ArrayLike<Alternativa> & { isFinal: boolean }
type EventoFala = { resultIndex: number; results: ArrayLike<ResultadoFala> }
type Reconhecedor = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: EventoFala) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type ConstrutorReconhecedor = new () => Reconhecedor

// Chrome/Android/Edge usam o prefixo webkit; Firefox não tem suporte (o botão some)
const Reconhecimento: ConstrutorReconhecedor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as Record<string, ConstrutorReconhecedor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, ConstrutorReconhecedor | undefined>).webkitSpeechRecognition)

const MENSAGENS: Record<string, string> = {
  'not-allowed': 'Permita o uso do microfone para falar.',
  'service-not-allowed': 'Permita o uso do microfone para falar.',
  'no-speech': 'Não ouvi nada. Tente de novo, perto do celular.',
  'audio-capture': 'Não encontramos o microfone do aparelho.',
  network: 'Sem internet para transformar a voz em texto.',
}

// Todas as alternativas de um resultado (o navegador pode mandar até maxAlternatives)
function alternativas(resultado: ResultadoFala): string[] {
  return Array.from({ length: resultado.length }, (_, i) => resultado[i].transcript)
}

type Props = { onTexto: (texto: string) => void }

// Ditado por voz: uma fala por toque. O texto entra uma vez só, quando a pessoa para de falar.
export default function BotaoDitado({ onTexto }: Props) {
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const reconhecedor = useRef<Reconhecedor | null>(null)
  const finais = useRef<string[]>([]) // trechos finais desta fala, na ordem em que chegaram

  // Para de ouvir se a tela fechar
  useEffect(() => () => reconhecedor.current?.stop(), [])

  if (!Reconhecimento) return null

  function alternar() {
    if (ouvindo) {
      reconhecedor.current?.stop()
      return
    }
    const r = new Reconhecimento!()
    r.lang = 'pt-BR'
    // Uma fala por toque: termina sozinho na pausa. O modo contínuo repete frases no Android.
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 3
    finais.current = []

    r.onresult = (e) => {
      let provisorio = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i]
        if (resultado.isFinal) finais.current[i] = escolherAlternativa(alternativas(resultado))
        else provisorio += resultado[0].transcript
      }
      setParcial(provisorio)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') setErro(MENSAGENS[e.error] ?? 'Não deu para usar a voz agora. Pode digitar.')
    }
    // Ao terminar, junta os trechos sem repetição e manda para a descrição uma vez só
    r.onend = () => {
      const texto = removerRepeticoes(finais.current.filter(Boolean))
      if (texto) onTexto(texto)
      finais.current = []
      setOuvindo(false)
      setParcial('')
    }

    reconhecedor.current = r
    setErro(null)
    setOuvindo(true)
    r.start()
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={ouvindo}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 text-lg font-semibold ${
          ouvindo ? 'animate-pulse border-red-500 bg-red-50 text-red-700' : 'border-folha-500 bg-white text-folha-700'
        }`}
      >
        {ouvindo ? '🔴 Ouvindo… pare de falar para terminar' : '🎤 Falar em vez de digitar'}
      </button>
      {parcial && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-gray-600 italic">{parcial}…</p>}
      {erro && <p className="mt-2 text-sm text-amber-800">{erro}</p>}
      <p className="mt-1 text-xs text-gray-500">
        Fale perto do celular, em lugar calmo. Depois confira e corrija o texto, se precisar. Para falar mais, toque de
        novo. A voz é transformada em texto pelo serviço do seu navegador.
      </p>
    </div>
  )
}
