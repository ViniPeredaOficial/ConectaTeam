import { escaparHtml, semHtml } from '../_shared/texto.ts'

export const AVISO_CATI = 'Procure a assistência técnica (CATI) antes de aplicar qualquer produto.'

export type DadosMensagem = {
  pragaComum: string | null
  pragaCientifica: string
  municipio: string
  raioKm: number
  cultura: string
  comoIdentificar: string | null
  manejo: string | null
  produtos: string[] // nomes comerciais, biológicos primeiro (sem dose nem concentração)
  simulado: boolean
}

// Monta o alerta em HTML do Telegram e em texto puro (o texto puro vai para a tabela alertas).
// A última linha é sempre o aviso da CATI (regra 4 e CHECK do banco).
export function montarMensagem(d: DadosMensagem): { titulo: string; html: string; texto: string } {
  const nomePraga = d.pragaComum
    ? `${escaparHtml(d.pragaComum)} (<i>${escaparHtml(d.pragaCientifica)}</i>)`
    : `<i>${escaparHtml(d.pragaCientifica)}</i>`

  const linhas = [
    d.simulado ? '🧪 <b>SIMULADO</b> (dado de demonstração)' : null,
    `🚨 <b>Alerta de praga: ${nomePraga}</b>`,
    `📍 <b>Região:</b> ${escaparHtml(d.municipio)} e arredores (raio de ${d.raioKm} km)`,
    `🌱 <b>Cultura:</b> ${escaparHtml(d.cultura)}`,
    d.comoIdentificar?.trim() ? `🔎 <b>Como identificar:</b> ${escaparHtml(d.comoIdentificar.trim())}` : null,
    d.manejo?.trim() ? `🛠️ <b>Manejo:</b> ${escaparHtml(d.manejo.trim())}` : null,
    d.produtos.length
      ? `✅ <b>Produtos registrados no Agrofit para esta cultura:</b> ${d.produtos.map(escaparHtml).join(', ')}`
      : null,
    'Fonte: Agrofit/MAPA. Validado por especialista.',
    `⚠️ <b>${AVISO_CATI}</b>`,
  ]

  const html = linhas.filter(Boolean).join('\n\n')
  return {
    titulo: semHtml(`Alerta de praga: ${nomePraga}`),
    html,
    texto: semHtml(html),
  }
}

// Nomes comerciais únicos (o Agrofit às vezes junta várias marcas com ";")
export function nomesDeProdutos(marcas: string[], limite = 5): string[] {
  const nomes: string[] = []
  for (const marca of marcas) {
    const nome = marca.split(';')[0].trim()
    if (nome && !nomes.includes(nome)) nomes.push(nome)
    if (nomes.length === limite) break
  }
  return nomes
}
