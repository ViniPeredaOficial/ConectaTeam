// Chamada à Bot API do Telegram. O token fica só no secret TELEGRAM_BOT_TOKEN.
// Lido na hora do uso (importar este arquivo não exige acesso às variáveis de ambiente)
const token = () => Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

export type RespostaTelegram = {
  ok: boolean
  description?: string
  error_code?: number
  parameters?: { retry_after?: number }
}

export function telegramConfigurado(): boolean {
  return token().length > 0
}

export async function telegram(metodo: string, corpo: Record<string, unknown>): Promise<RespostaTelegram> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await fetch(`https://api.telegram.org/bot${token()}/${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(10_000),
      })
      const json = (await resposta.json()) as RespostaTelegram
      // Limite de envio do Telegram: espera o tempo pedido e tenta uma vez de novo
      if (json.error_code === 429 && tentativa === 0) {
        await new Promise((r) => setTimeout(r, (json.parameters?.retry_after ?? 1) * 1000))
        continue
      }
      return json
    } catch {
      return { ok: false, description: 'falha_de_rede' }
    }
  }
  return { ok: false, description: 'limite_de_envio' }
}

// Código do link t.me/<bot>?start=<código>: 32 caracteres hexadecimais
export function codigoDoStart(texto: string): string | null {
  const [comando, codigo] = texto.trim().split(/\s+/)
  if (!/^\/start(@\w+)?$/i.test(comando ?? '')) return null
  return codigo && /^[a-f0-9]{32}$/.test(codigo) ? codigo : null
}
