import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { iconeDaCultura } from '../lib/culturas'
import { agruparPorPraga, nomePraga, posicaoNoAnel, raioDoCirculo } from '../lib/mapa'
import type { AlertaDoMapa, GrupoPraga } from '../lib/mapa'
import { supabase } from '../lib/supabase'

// Alerta como o mapa precisa: só dados públicos (alertas + centroide do município)
type AlertaMapa = AlertaDoMapa & { canal_enviado: boolean; destinatarios: number }
type Modo = 'separar' | 'sobrepor'

const CENTRO_REGIAO: [number, number] = [-21.7845, -48.178] // Araraquara
const PERIODOS = [7, 15, 30]
// Cores bem distintas entre si para as pragas
const PALETA = ['#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569']

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

// Mapa de alertas dos últimos 30 dias: um círculo por praga em cada município, no centroide
// (nunca no ponto do produtor), com filtro de pragas e modo sobrepor/separar
export default function MapaAlertas({ altura = 'h-80', rolagem = false }: Props) {
  const [alertas, setAlertas] = useState<AlertaMapa[] | null>(null)
  const [erro, setErro] = useState(false)
  const [cultura, setCultura] = useState('todas')
  const [dias, setDias] = useState(30)
  const [ocultas, setOcultas] = useState<Set<string>>(new Set()) // pragas desligadas no filtro
  const [modo, setModo] = useState<Modo>('separar')
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

  // Cor fixa por praga (calculada sobre todos os alertas: não muda ao filtrar)
  const cores = useMemo(() => {
    const pragas = [...new Set((alertas ?? []).map(nomePraga))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return new Map(pragas.map((p, i) => [p, PALETA[i % PALETA.length]]))
  }, [alertas])

  // Alertas no período e cultura escolhidos; contagem por praga para o filtro
  const { noPeriodo, contagem } = useMemo(() => {
    const limite = carregadoEm - dias * 24 * 3600 * 1000
    const lista = (alertas ?? []).filter(
      (a) => new Date(a.enviado_em).getTime() >= limite && (cultura === 'todas' || a.cultura === cultura),
    )
    const porPraga = new Map<string, number>()
    for (const a of lista) porPraga.set(nomePraga(a), (porPraga.get(nomePraga(a)) ?? 0) + 1)
    return { noPeriodo: lista, contagem: [...porPraga.entries()].sort((x, y) => y[1] - x[1]) }
  }, [alertas, cultura, dias, carregadoEm])

  const grupos = useMemo(
    () => agruparPorPraga(noPeriodo.filter((a) => !ocultas.has(nomePraga(a)))),
    [noPeriodo, ocultas],
  )
  const visiveis = grupos.reduce((soma, g) => soma + g.alertas.length, 0)
  const municipios = new Set(grupos.map((g) => g.cod)).size

  function alternarPraga(praga: string) {
    setOcultas((atual) => {
      const nova = new Set(atual)
      if (nova.has(praga)) nova.delete(praga)
      else nova.add(praga)
      return nova
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Filtros: cultura, período e modo de exibição */}
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
        <BotoesEscolha
          rotulo="Período"
          opcoes={PERIODOS.map((p) => ({ valor: p, texto: `${p} dias` }))}
          atual={dias}
          onEscolher={setDias}
        />
        <BotoesEscolha
          rotulo="Exibição dos círculos"
          opcoes={[
            { valor: 'separar' as Modo, texto: 'Separar' },
            { valor: 'sobrepor' as Modo, texto: 'Sobrepor' },
          ]}
          atual={modo}
          onEscolher={setModo}
        />
      </div>

      {/* Filtro de pragas (também é a legenda) */}
      {contagem.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-700">Pragas:</span>
            <button type="button" onClick={() => setOcultas(new Set())} className="font-semibold text-folha-700 underline">
              Mostrar todas
            </button>
            <button
              type="button"
              onClick={() => setOcultas(new Set(contagem.map(([p]) => p)))}
              className="font-semibold text-folha-700 underline"
            >
              Esconder todas
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {contagem.map(([praga, total]) => {
              const ligada = !ocultas.has(praga)
              return (
                <li key={praga}>
                  <button
                    type="button"
                    onClick={() => alternarPraga(praga)}
                    aria-pressed={ligada}
                    className={`flex min-h-10 items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold ${
                      ligada ? 'border-gray-300 bg-white text-gray-800' : 'border-dashed border-gray-300 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: ligada ? cores.get(praga) : '#d1d5db' }}
                    />
                    {praga} ({total})
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Mapa */}
      <div className={`relative ${altura} overflow-hidden rounded-xl`}>
        <MapContainer center={CENTRO_REGIAO} zoom={10} scrollWheelZoom={rolagem} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circulos grupos={grupos} cores={cores} modo={modo} />
        </MapContainer>
        {alertas && grupos.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-lg bg-white/90 px-3 py-1 text-sm shadow">
            {noPeriodo.length ? 'Nenhuma praga selecionada.' : 'Nenhum alerta neste período.'}
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-red-700">Não conseguimos carregar os alertas.</p>}

      {alertas && grupos.length > 0 && (
        <p className="text-sm text-gray-700">
          {visiveis} {visiveis === 1 ? 'alerta' : 'alertas'} · {grupos.length} {grupos.length === 1 ? 'círculo' : 'círculos'}{' '}
          · {municipios} {municipios === 1 ? 'município' : 'municípios'}
        </p>
      )}
      <p className="text-xs text-gray-500">
        Um círculo por praga em cada município, no centro do município (nunca na localização do produtor). Tamanho =
        número de alertas. Em "Separar", os círculos se espalham em volta do centro só para ficarem visíveis.
      </p>
    </div>
  )
}

// Grupo de botões em que só um fica escolhido (período, modo)
function BotoesEscolha<T extends string | number>({
  rotulo,
  opcoes,
  atual,
  onEscolher,
}: {
  rotulo: string
  opcoes: { valor: T; texto: string }[]
  atual: T
  onEscolher: (valor: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border-2 border-gray-200" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onEscolher(o.valor)}
          aria-pressed={atual === o.valor}
          className={`min-h-10 px-3 ${atual === o.valor ? 'bg-folha-600 text-white' : 'bg-white text-gray-700'}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

// Círculos dentro do mapa. No modo "separar", os de um mesmo município ficam num anel em volta
// do centro, com distância em pixels de tela (recalculada a cada zoom para nunca se cobrirem).
function Circulos({ grupos, cores, modo }: { grupos: GrupoPraga[]; cores: Map<string, string>; modo: Modo }) {
  const mapa = useMap()
  const [zoom, setZoom] = useState(() => mapa.getZoom())
  useMapEvents({ zoomend: () => setZoom(mapa.getZoom()) })

  // Posição de cada círculo (por município, os de mais alertas primeiro)
  const porMunicipio = new Map<number, GrupoPraga[]>()
  for (const g of grupos) porMunicipio.set(g.cod, [...(porMunicipio.get(g.cod) ?? []), g])

  const desenhar: { g: GrupoPraga; centro: [number, number]; raio: number }[] = []
  for (const lista of porMunicipio.values()) {
    const maiorRaio = Math.max(...lista.map((g) => raioDoCirculo(g.alertas.length)))
    lista.forEach((g, i) => {
      let centro: [number, number] = [g.lat, g.lon]
      if (modo === 'separar' && lista.length > 1) {
        const { dx, dy } = posicaoNoAnel(i, lista.length, maiorRaio)
        const ponto = mapa.project([g.lat, g.lon], zoom).add([dx, dy])
        const deslocado = mapa.unproject(ponto, zoom)
        centro = [deslocado.lat, deslocado.lng]
      }
      desenhar.push({ g, centro, raio: raioDoCirculo(g.alertas.length) })
    })
  }
  // Sobrepor: os maiores são desenhados primeiro, para os menores ficarem por cima
  desenhar.sort((a, b) => b.raio - a.raio)

  return (
    <>
      {desenhar.map(({ g, centro, raio }) => {
        const cor = cores.get(g.praga) ?? PALETA[0]
        return (
          <CircleMarker
            key={g.chave}
            center={centro}
            radius={raio}
            pathOptions={{ color: cor, fillColor: cor, fillOpacity: modo === 'sobrepor' ? 0.35 : 0.5, weight: 2 }}
          >
            <Popup>
              <strong>
                {g.praga} em {g.municipio} · {g.alertas.length} {g.alertas.length === 1 ? 'alerta' : 'alertas'}
              </strong>
              <ul className="mt-1 space-y-1">
                {g.alertas.map((a) => (
                  <li key={a.id}>
                    {iconeDaCultura(a.cultura ?? '')} {a.cultura}
                    {a.praga_nome_cientifico && <i> ({a.praga_nome_cientifico})</i>} ·{' '}
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
    </>
  )
}
