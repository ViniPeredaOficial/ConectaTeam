// Minúsculas e sem acento (mesma regra das colunas *_busca)
export function paraBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Escapa texto livre para o parse_mode HTML do Telegram
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Converte o HTML da mensagem em texto puro (o que o Telegram mostra e conta)
export function semHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
