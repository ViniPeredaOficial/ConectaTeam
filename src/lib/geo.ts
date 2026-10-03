import type { Municipio } from '../types/database'
import limiteSaoPaulo from '../assets/limite-sp.json' with { type: 'json' }

const POLIGONO_SAO_PAULO = limiteSaoPaulo as [number, number][]

// Acima disso, provavelmente a pessoa está fora de SP ou o GPS falhou: pedimos para escolher na lista
export const DISTANCIA_MAXIMA_KM = 50

// O limite vem da mesma base de divisas estaduais usada no mapa do globo.
export function coordenadaEmSaoPaulo(lat: number, lon: number): boolean {
  let dentro = false
  for (let i = 0, j = POLIGONO_SAO_PAULO.length - 1; i < POLIGONO_SAO_PAULO.length; j = i++) {
    const [latI, lonI] = POLIGONO_SAO_PAULO[i]
    const [latJ, lonJ] = POLIGONO_SAO_PAULO[j]
    const cruza = latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI
    if (cruza) dentro = !dentro
  }
  return dentro
}

// Distância em km entre dois pontos (fórmula de haversine)
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

// Município cujo centro está mais perto da coordenada (calculado no navegador)
export function municipioMaisProximo(lat: number, lon: number, municipios: Municipio[]) {
  let melhor: { municipio: Municipio; distancia: number } | null = null
  for (const m of municipios) {
    const distancia = distanciaKm(lat, lon, m.lat, m.lon)
    if (!melhor || distancia < melhor.distancia) melhor = { municipio: m, distancia }
  }
  return melhor
}

// Promessa em volta do navigator.geolocation
export function pegarLocalizacao(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('sem_suporte'))
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    })
  })
}
