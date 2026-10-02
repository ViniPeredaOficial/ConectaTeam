// Risco climático a partir da previsão da Open-Meteo (gratuita, sem chave, CC-BY 4.0).
// Indicador SIMPLIFICADO para orientar atenção, não para diagnóstico:
//   - Doenças fúngicas: horas com umidade >= 90% e 12 a 26 °C (aproxima folha molhada)
//   - Pragas de tempo quente e seco: horas com mais de 28 °C e umidade < 50%

export type Nivel = 'baixo' | 'medio' | 'alto'
export type Local = { cod: number; nome: string; lat: number; lon: number }
export type HorasPrevisao = { temperatura: number[]; umidade: number[]; chuva: number[] }
export type Risco = {
  fungos: { nivel: Nivel; horas: number }
  seco: { nivel: Nivel; horas: number }
  chuvaMm: number
  tMin: number
  tMax: number
}

export const HORAS_PREVISAO = 72
export const LIMITE_ALTO = 12
export const LIMITE_MEDIO = 6

export function nivelPorHoras(horas: number): Nivel {
  if (horas >= LIMITE_ALTO) return 'alto'
  if (horas >= LIMITE_MEDIO) return 'medio'
  return 'baixo'
}

// Calcula os dois indicadores a partir das horas da previsão
export function calcularRisco(h: HorasPrevisao): Risco {
  let fungos = 0
  let seco = 0
  h.temperatura.forEach((t, i) => {
    const u = h.umidade[i]
    if (u >= 90 && t >= 12 && t <= 26) fungos++
    if (t > 28 && u < 50) seco++
  })
  return {
    fungos: { nivel: nivelPorHoras(fungos), horas: fungos },
    seco: { nivel: nivelPorHoras(seco), horas: seco },
    chuvaMm: Math.round(h.chuva.reduce((soma, c) => soma + (c ?? 0), 0) * 10) / 10,
    tMin: Math.round(Math.min(...h.temperatura)),
    tMax: Math.round(Math.max(...h.temperatura)),
  }
}

// Peso para ordenar municípios do maior para o menor risco
export function pesoDoRisco(r: Risco): number {
  const valor = { baixo: 0, medio: 1, alto: 2 }
  return Math.max(valor[r.fungos.nivel], valor[r.seco.nivel]) * 1000 + r.fungos.horas + r.seco.horas
}

// Previsão guardada por 1 hora (evita repetir a chamada a cada tela)
const cache = new Map<string, { quando: number; dados: Map<number, Risco> }>()
const VALIDADE_MS = 60 * 60 * 1000

type RespostaOpenMeteo = {
  hourly: { temperature_2m: number[]; relative_humidity_2m: number[]; precipitation: number[] }
}

// Uma chamada só para vários municípios; devolve o risco por código IBGE
export async function buscarRiscos(locais: Local[]): Promise<Map<number, Risco>> {
  if (!locais.length) return new Map()
  const chave = locais.map((l) => l.cod).join(',')
  const guardado = cache.get(chave)
  if (guardado && Date.now() - guardado.quando < VALIDADE_MS) return guardado.dados

  const parametros = new URLSearchParams({
    latitude: locais.map((l) => l.lat.toFixed(4)).join(','),
    longitude: locais.map((l) => l.lon.toFixed(4)).join(','),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation',
    forecast_hours: String(HORAS_PREVISAO),
    timezone: 'America/Sao_Paulo',
  })
  const resposta = await fetch(`https://api.open-meteo.com/v1/forecast?${parametros}`)
  if (!resposta.ok) throw new Error(`open_meteo_http_${resposta.status}`)
  const json = (await resposta.json()) as RespostaOpenMeteo | RespostaOpenMeteo[]
  const lista = Array.isArray(json) ? json : [json] // um local só vem como objeto

  const dados = new Map<number, Risco>()
  lista.forEach((item, i) => {
    dados.set(
      locais[i].cod,
      calcularRisco({
        temperatura: item.hourly.temperature_2m,
        umidade: item.hourly.relative_humidity_2m,
        chuva: item.hourly.precipitation,
      }),
    )
  })
  cache.set(chave, { quando: Date.now(), dados })
  return dados
}
