// Apoio aos gráficos do painel de administração (lógica pura, testada em graficos.test.ts)

// Cores das séries: azul e laranja da paleta validada (contraste e daltonismo), sempre nesta ordem
export const COR_ALERTAS = '#2a78d6'
export const COR_CHAMADOS = '#eb6834'

// Marcas "redondas" do eixo Y: 0 até um teto limpo (1, 2, 5 × 10^n), com no máximo ~5 divisões
export function marcasDoEixo(maximo: number, divisoes = 4): number[] {
  if (maximo <= 0) return [0, 1]
  const bruto = maximo / divisoes
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto)!
  const passoInteiro = Math.max(1, Math.round(passo)) // contagens: nunca 0,5 alerta
  const teto = Math.ceil(maximo / passoInteiro) * passoInteiro
  return Array.from({ length: teto / passoInteiro + 1 }, (_, i) => i * passoInteiro)
}

// "2026-10-02" -> "02/10"
export function diaCurto(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

// Índice do ponto mais próximo de uma posição x (0 a 1) numa série de n pontos
export function indiceMaisProximo(fracao: number, n: number): number {
  if (n <= 1) return 0
  return Math.min(n - 1, Math.max(0, Math.round(fracao * (n - 1))))
}
