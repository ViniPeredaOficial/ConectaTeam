import { useEffect, useRef, useState } from 'react'

// Tipos mínimos da Web Speech API (não fazem parte do TypeScript padrão)
type ResultadoFala = { isFinal: boolean; 0: { transcript: string } }
type EventoFala = { resultIndex: number; results: ArrayLike<ResultadoFala> }
type Reconhecedor = {
  lang: string
  continuous: boolean
  interimResults: boolean
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

type Props = { onTexto: (texto: string) => void }

// Ditado por voz: a pessoa fala e o texto é acrescentado à descrição
export default function BotaoDitado({ onTexto }: Props) {
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const reconhecedor = useRef<Reconhecedor | null>(null)

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
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let provisorio = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const trecho = e.results[i][0].transcript
        if (e.results[i].isFinal) onTexto(trecho.trim())
        else provisorio += trecho
      }
      setParcial(provisorio)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') setErro(MENSAGENS[e.error] ?? 'Não deu para usar a voz agora. Pode digitar.')
    }
    r.onend = () => {
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
        {ouvindo ? '🔴 Ouvindo… toque para parar' : '🎤 Falar em vez de digitar'}
      </button>
      {parcial && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-gray-600 italic">{parcial}…</p>}
      {erro && <p className="mt-2 text-sm text-amber-800">{erro}</p>}
      <p className="mt-1 text-xs text-gray-500">A voz é transformada em texto pelo serviço do seu navegador.</p>
    </div>
  )
}
