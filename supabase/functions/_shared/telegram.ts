// Chamada à Bot API do Telegram. O token fica só no secret TELEGRAM_BOT_TOKEN.
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

export type RespostaTelegram = {
  ok: boolean
  description?: string
  error_code?: number
  parameters?: { retry_after?: number }
}

export function telegramConfigurado(): boolean {
  return TOKEN.length > 0
}

export async function telegram(metodo: string, corpo: Record<string, unknown>): Promise<RespostaTelegram> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await fetch(`https://api.telegram.org/bot${TOKEN}/${metodo}`, {
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
