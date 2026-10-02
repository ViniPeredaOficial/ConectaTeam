import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { iconeDaCultura } from '../lib/culturas'
import { supabase } from '../lib/supabase'

// Alerta como o mapa precisa: só dados públicos (alertas + centroide do município)
type AlertaMapa = {
  id: string
  enviado_em: string
  cultura: string | null
  praga_nome_comum: string | null
  praga_nome_cientifico: string | null
  simulado: boolean
  canal_enviado: boolean
  destinatarios: number
  municipio_cod: number
  municipios: { nome: string; lat: number; lon: number } | null
}

type Grupo = { cod: number; nome: string; lat: number; lon: number; alertas: AlertaMapa[]; praga: string }

const CENTRO_REGIAO: [number, number] = [-21.7845, -48.178] // Araraquara
const PERIODOS = [7, 15, 30]
// Cores bem distintas entre si para as pragas
const PALETA = ['#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569']

function nomePraga(a: AlertaMapa): string {
  return a.praga_nome_comum?.split(';')[0].trim() || a.praga_nome_cientifico || 'Praga'
}

async function buscarAlertas(): Promise<AlertaMapa[]> {
  const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('alertas')
    .select(
      'id, enviado_em, cultura, praga_nome_comum, praga_nome_cientifico, simulado, canal_enviado, destinatarios, ' +
        'municipio_cod, municipios(nome, lat, lon)',
    )
    .gte('enviado_em', desde)
    .order('enviado_em', { ascending: false })
    .returns<AlertaMapa[]>()
  if (error) throw error
  // Só alertas que saíram de verdade, ou os simulados da demonstração
  return data.filter((a) => a.municipios && (a.simulado || a.canal_enviado || a.destinatarios > 0))
}

type Props = { altura?: string; rolagem?: boolean }

// Mapa de alertas dos últimos 30 dias: um círculo por município, no centroide (nunca no ponto do produtor)
export default function MapaAlertas({ altura = 'h-80', rolagem = false }: Props) {
  const [alertas, setAlertas] = useState<AlertaMapa[] | null>(null)
  const [erro, setErro] = useState(false)
  const [cultura, setCultura] = useState('todas')
  const [dias, setDias] = useState(30)
  // Momento da consulta: referência fixa para o filtro de período
  const [carregadoEm, setCarregadoEm] = useState(0)

  useEffect(() => {
    buscarAlertas()
      .then((lista) => {
        setAlertas(lista)
        setCarregadoEm(Date.now())
      })
      .catch((e) => {
        console.error('Falha ao carregar alertas do mapa', e)
        setErro(true)
      })
  }, [])

  const culturas = useMemo(
    () => [...new Set((alertas ?? []).map((a) => a.cultura).filter((c): c is string => Boolean(c)))].sort(),
    [alertas],
  )

  // Filtra, agrupa por município e define cor pela praga predominante
  const { grupos, cores } = useMemo(() => {
    const limite = carregadoEm - dias * 24 * 3600 * 1000
    const filtrados = (alertas ?? []).filter(
      (a) => new Date(a.enviado_em).getTime() >= limite && (cultura === 'todas' || a.cultura === cultura),
    )

    const pragas = [...new Set(filtrados.map(nomePraga))].sort()
    const cores = new Map(pragas.map((p, i) => [p, PALETA[i % PALETA.length]]))

    const porMunicipio = new Map<number, Grupo>()
    for (const a of filtrados) {
      const g = porMunicipio.get(a.municipio_cod) ?? {
        cod: a.municipio_cod,
        nome: a.municipios!.nome,
        lat: a.municipios!.lat,
        lon: a.municipios!.lon,
        alertas: [],
        praga: '',
      }
      g.alertas.push(a)
      porMunicipio.set(a.municipio_cod, g)
    }
    for (const g of porMunicipio.values()) {
      const contagem = new Map<string, number>()
      for (const a of g.alertas) contagem.set(nomePraga(a), (contagem.get(nomePraga(a)) ?? 0) + 1)
      g.praga = [...contagem.entries()].sort((x, y) => y[1] - x[1])[0][0]
    }
    return { grupos: [...porMunicipio.values()], cores }
  }, [alertas, cultura, dias, carregadoEm])

  return (
    <div className="flex flex-col gap-2">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={cultura}
          onChange={(e) => setCultura(e.target.value)}
          className="min-h-10 rounded-lg border-2 border-gray-200 bg-white px-2"
          aria-label="Filtrar por cultura"
        >
          <option value="todas">Todas as culturas</option>
          {culturas.map((c) => (
            <option key={c} value={c}>
              {iconeDaCultura(c)} {c}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border-2 border-gray-200" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDias(p)}
              aria-pressed={dias === p}
              className={`min-h-10 px-3 ${dias === p ? 'bg-folha-600 text-white' : 'bg-white text-gray-700'}`}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {/* Mapa */}
      <div className={`relative ${altura} overflow-hidden rounded-xl`}>
        <MapContainer center={CENTRO_REGIAO} zoom={10} scrollWheelZoom={rolagem} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {grupos.map((g) => {
            const cor = cores.get(g.praga) ?? PALETA[0]
            return (
              <CircleMarker
                key={g.cod}
                center={[g.lat, g.lon]}
                radius={Math.min(30, 9 + 5 * (g.alertas.length - 1))}
                pathOptions={{ color: cor, fillColor: cor, fillOpacity: 0.45, weight: 2 }}
              >
                <Popup>
                  <strong>
                    {g.nome} · {g.alertas.length} {g.alertas.length === 1 ? 'alerta' : 'alertas'}
                  </strong>
                  <ul className="mt-1 space-y-1">
                    {g.alertas.map((a) => (
                      <li key={a.id}>
                        {iconeDaCultura(a.cultura ?? '')} <b>{nomePraga(a)}</b>
                        {a.praga_nome_cientifico && <i> ({a.praga_nome_cientifico})</i>} · {a.cultura} ·{' '}
                        {new Date(a.enviado_em).toLocaleDateString('pt-BR')}
                        {a.simulado && (
                          <span className="ml-1 rounded-full bg-purple-100 px-1.5 text-xs font-semibold text-purple-800">
                            simulado
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        {alertas && grupos.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-lg bg-white/90 px-3 py-1 text-sm shadow">
            Nenhum alerta neste período.
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-red-700">Não conseguimos carregar os alertas.</p>}

      {/* Legenda */}
      {cores.size > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {[...cores.entries()].map(([praga, cor]) => (
            <li key={praga} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cor }} />
              {praga}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-500">
        Círculos no centro de cada município (nunca na localização do produtor). Tamanho = número de alertas.
      </p>
    </div>
  )
}
