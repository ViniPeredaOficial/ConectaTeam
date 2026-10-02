import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { linkParaLigarConta } from '../lib/telegram'

type Estado = 'carregando' | 'desligado' | 'ligado'

async function avisosLigados(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return false
  const { data } = await supabase.from('perfis').select('telegram_chat_id').eq('id', session.user.id).maybeSingle()
  return Boolean(data?.telegram_chat_id)
}

// Cartão "Receber aviso no Telegram" da tela Meus chamados
export default function AvisoTelegram() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [link, setLink] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  const conferir = useCallback(() => {
    avisosLigados().then((ligado) => {
      setEstado(ligado ? 'ligado' : 'desligado')
      if (ligado) setLink(null)
    })
  }, [])

  useEffect(conferir, [conferir])

  // Quando a pessoa volta do Telegram para o app, confere se ligou
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && conferir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [conferir])

  async function gerarLink() {
    setGerando(true)
    setErro(null)
    const { data, error } = await supabase.rpc('gerar_codigo_telegram')
    setGerando(false)
    if (error || typeof data !== 'string') return setErro('Não conseguimos gerar o link. Tente de novo.')
    setLink(linkParaLigarConta(data))
  }

  async function desligar() {
    await supabase.rpc('desligar_avisos_telegram')
    conferir()
  }

  if (estado === 'carregando') return null

  if (estado === 'ligado') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-folha-100 p-4 text-folha-900">
        <span>✅ Avisos no Telegram ligados: você recebe uma mensagem quando o especialista responder.</span>
        <button onClick={desligar} className="shrink-0 text-sm font-semibold underline">
          Desligar
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="font-semibold text-gray-900">📲 Quer ser avisado no Telegram quando o especialista responder?</p>
      {!link ? (
        <button
          onClick={gerarLink}
          disabled={gerando}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#229ED9] px-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {gerando ? 'Preparando...' : 'Receber aviso no Telegram'}
        </button>
      ) : (
        <>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#229ED9] px-4 text-lg font-semibold text-white"
          >
            Abrir o Telegram
          </a>
          <p className="mt-2 text-sm text-gray-600">
            No Telegram, toque em <strong>Iniciar</strong>. Depois volte aqui. O link vale por 30 minutos.
          </p>
          <button onClick={conferir} className="mt-1 text-sm font-semibold text-folha-700 underline">
            Já toquei em Iniciar
          </button>
        </>
      )}
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
    </div>
  )
}
