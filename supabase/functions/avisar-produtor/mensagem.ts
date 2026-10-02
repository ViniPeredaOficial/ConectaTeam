import { escaparHtml } from '../_shared/texto.ts'

export const AVISO_CATI = 'Procure a assistência técnica (CATI) antes de aplicar qualquer produto.'

export type DadosAviso = {
  status: 'analisado' | 'descartado'
  cultura: string
  enviadoEm: string // ISO
  pragaComum: string | null
  pragaCientifica: string | null
  urlApp: string
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

// Mensagem particular ao produtor (HTML do Telegram). Curta: os detalhes ficam no app.
// Nunca traz manejo nem produtos (sem risco de dose); sempre termina com o aviso da CATI.
export function mensagemAoProdutor(d: DadosAviso): string {
  const chamado = `${escaparHtml(d.cultura)} enviado em ${dataCurta(d.enviadoEm)}`

  if (d.status === 'descartado') {
    return [
      `ℹ️ Seu chamado de ${chamado} foi <b>encerrado</b> pelo especialista.`,
      `Se o problema continuar, envie uma nova foto, de perto e com luz do dia:\n${d.urlApp}/produtor`,
      `⚠️ <b>${AVISO_CATI}</b>`,
    ].join('\n\n')
  }

  const comum = d.pragaComum?.split(';')[0].trim()
  const praga = comum
    ? `<b>${escaparHtml(comum)}</b>${d.pragaCientifica ? ` (<i>${escaparHtml(d.pragaCientifica)}</i>)` : ''}`
    : `<b><i>${escaparHtml(d.pragaCientifica ?? 'praga identificada')}</i></b>`

  return [
    '✅ <b>Seu chamado foi respondido!</b>',
    `🌱 ${chamado}\n🔎 Praga confirmada pelo especialista: ${praga}`,
    `Veja como identificar e o manejo recomendado:\n${d.urlApp}/produtor/chamados`,
    `⚠️ <b>${AVISO_CATI}</b>`,
  ].join('\n\n')
}
