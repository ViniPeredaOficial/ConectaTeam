// Agrupamento e posição dos círculos do mapa de alertas (lógica pura, testada em mapa.test.ts)

export type AlertaDoMapa = {
  id: string
  enviado_em: string
  cultura: string | null
  praga_nome_comum: string | null
  praga_nome_cientifico: string | null
  simulado: boolean
  municipio_cod: number
  municipios: { nome: string; lat: number; lon: number } | null
}

// Um círculo = uma praga em um município
export type GrupoPraga = {
  chave: string
  cod: number
  municipio: string
  lat: number
  lon: number
  praga: string
  alertas: AlertaDoMapa[]
}

// Nome curto da praga: o Agrofit junta vários nomes comuns com ";"
export function nomePraga(a: Pick<AlertaDoMapa, 'praga_nome_comum' | 'praga_nome_cientifico'>): string {
  return a.praga_nome_comum?.split(';')[0].trim() || a.praga_nome_cientifico || 'Praga'
}

// Agrupa por município + praga; dentro de cada município, as pragas com mais alertas vêm primeiro
export function agruparPorPraga(alertas: AlertaDoMapa[]): GrupoPraga[] {
  const grupos = new Map<string, GrupoPraga>()
  for (const a of alertas) {
    if (!a.municipios) continue
    const praga = nomePraga(a)
    const chave = `${a.municipio_cod}|${praga}`
    const g = grupos.get(chave) ?? {
      chave,
      cod: a.municipio_cod,
      municipio: a.municipios.nome,
      lat: a.municipios.lat,
      lon: a.municipios.lon,
      praga,
      alertas: [],
    }
    g.alertas.push(a)
    grupos.set(chave, g)
  }
  return [...grupos.values()].sort(
    (x, y) => x.cod - y.cod || y.alertas.length - x.alertas.length || x.praga.localeCompare(y.praga, 'pt-BR'),
  )
}

// Raio do círculo em pixels: cresce com o número de alertas, até um limite
export function raioDoCirculo(quantidade: number): number {
  return Math.min(26, 9 + 5 * (quantidade - 1))
}

// Modo "separar": posição (em pixels) do i-ésimo de n círculos num anel em volta do centro do município.
// O anel é largo o bastante para círculos vizinhos de raio até `maiorRaio` não se cobrirem.
export function posicaoNoAnel(i: number, n: number, maiorRaio: number): { dx: number; dy: number } {
  if (n <= 1) return { dx: 0, dy: 0 }
  const raioAnel = maiorRaio / Math.sin(Math.PI / n) + 4
  const angulo = -Math.PI / 2 + (2 * Math.PI * i) / n // o primeiro fica em cima
  return { dx: Math.round(raioAnel * Math.cos(angulo)), dy: Math.round(raioAnel * Math.sin(angulo)) }
}
