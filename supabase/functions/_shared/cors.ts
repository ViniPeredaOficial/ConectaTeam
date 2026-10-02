// CORS: só libera as origens do secret ALLOWED_ORIGINS (separadas por vírgula).
// Aceita "*" no lugar de um trecho do domínio, para os previews do Vercel:
// ALLOWED_ORIGINS=http://localhost:5173,https://conectateam.vercel.app,https://conectateam-*-ponto-de-retorno.vercel.app
// O "*" casa só letras minúsculas, números e hífen (nunca ponto, barra ou dois-pontos).

// Lido na hora do uso (importar este arquivo não exige acesso às variáveis de ambiente)
function listaPermitida(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function origemPermitida(origem: string, permitidas: string[]): boolean {
  return permitidas.some((padrao) => {
    if (!padrao.includes('*')) return padrao === origem
    const regex = '^' + padrao.split('*').map((parte) => parte.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[a-z0-9-]+') + '$'
    return new RegExp(regex).test(origem)
  })
}

export function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get('Origin') ?? ''
  const permitidas = listaPermitida()
  return {
    // Origem não permitida recebe a primeira da lista: o navegador bloqueia a chamada
    'Access-Control-Allow-Origin': origemPermitida(origem, permitidas) ? origem : permitidas[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}
