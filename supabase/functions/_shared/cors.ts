// CORS: só libera as origens do secret ALLOWED_ORIGINS (separadas por vírgula).
// Ex.: ALLOWED_ORIGINS=http://localhost:5173,https://radar-de-pragas.vercel.app
const origensPermitidas = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origensPermitidas.includes(origem) ? origem : origensPermitidas[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
