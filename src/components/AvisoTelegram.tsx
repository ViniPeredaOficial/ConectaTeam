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
      <section
        aria-labelledby="titulo-aviso-telegram"
        className="relative overflow-hidden rounded-3xl bg-folha-800 p-5 pr-28 text-white sm:p-7 sm:pr-32"
      >
        <h2 id="titulo-aviso-telegram" className="text-lg font-bold">
          Avisos do Telegram ativados
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-folha-50">
          Você recebe uma mensagem quando o especialista responder ao seu chamado.
        </p>
        <button
          onClick={desligar}
          className="mt-4 min-h-11 rounded-xl border border-white/70 px-4 text-sm font-semibold text-white hover:bg-folha-700"
        >
          Desligar avisos
        </button>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="titulo-aviso-telegram"
      className="relative overflow-hidden rounded-3xl bg-folha-800 p-5 pr-28 text-white sm:p-7 sm:pr-32"
    >
      <h2 id="titulo-aviso-telegram" className="text-lg font-bold">
        Receba as respostas pelo Telegram
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-folha-50">
        Vincule sua conta para receber uma mensagem quando o especialista analisar seu chamado.
      </p>
      {!link ? (
        <button
          onClick={gerarLink}
          disabled={gerando}
          className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-folha-800 hover:bg-folha-50 disabled:opacity-50"
        >
          {gerando ? 'Preparando...' : 'Ativar avisos no Telegram'}
        </button>
      ) : (
        <>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-folha-800 hover:bg-folha-50"
          >
            Abrir o Telegram
          </a>
          <p className="mt-3 text-sm text-folha-50">
            No Telegram, toque em <strong>Iniciar</strong>. Depois volte aqui. O link vale por 30 minutos.
          </p>
          <button onClick={conferir} className="mt-2 text-sm font-semibold text-white underline underline-offset-2">
            Já toquei em Iniciar
          </button>
        </>
      )}
      {erro && <p role="alert" className="mt-3 text-sm font-semibold text-red-200">{erro}</p>}
    </section>
  )
}
