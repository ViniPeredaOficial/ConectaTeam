import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { buscarAlertasPublicos } from '../lib/alertasPublicos'
import type { AlertaPublico } from '../lib/alertasPublicos'
import { iconeDaCultura } from '../lib/culturas'
import { agruparPorPraga, nomePraga, posicaoNoAnel, raioDoCirculo } from '../lib/mapa'
import type { GrupoPraga } from '../lib/mapa'
import { tempoRelativo } from '../lib/tempoRelativo'

type Modo = 'separar' | 'sobrepor'

const CENTRO_REGIAO: [number, number] = [-21.7845, -48.178] // Araraquara
const PERIODOS = [7, 15, 30]
const ATUALIZAR_MS = 45_000
// Cores bem distintas entre si para as pragas
const PALETA = ['#cc060a', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569']

type Props = { altura?: string; rolagem?: boolean; centroInicial?: [number, number] }

// Mapa de alertas dos últimos 30 dias: um círculo por praga em cada município, no centroide
// (nunca no ponto do produtor), com filtro de pragas e modo sobrepor/separar
export default function MapaAlertas({
  altura = 'h-80',
  rolagem = false,
  centroInicial = CENTRO_REGIAO,
}: Props) {
  const [alertas, setAlertas] = useState<AlertaPublico[] | null>(null)
  const [erro, setErro] = useState(false)
  const [cultura, setCultura] = useState('todas')
  const [dias, setDias] = useState(30)
  const [ocultas, setOcultas] = useState<Set<string>>(new Set()) // pragas desligadas no filtro
  const [modo, setModo] = useState<Modo>('separar')
  // Momento da consulta: referência fixa para o filtro de período
  const [carregadoEm, setCarregadoEm] = useState(0)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const lista = await buscarAlertasPublicos()
        if (!ativo) return
        setAlertas(lista)
        setCarregadoEm(Date.now())
        setErro(false)
      } catch (e) {
        console.error('Falha ao carregar alertas do mapa', e)
        if (ativo) setErro(true)
      }
    }
    void carregar()
    const timer = window.setInterval(carregar, ATUALIZAR_MS)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
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
      <div className="flex flex-col items-stretch gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={cultura}
          onChange={(e) => setCultura(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-folha-300 bg-white px-3 text-base text-gray-800 focus:border-folha-600 focus:outline-2 focus:outline-folha-500 sm:w-auto"
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`relative ${altura} min-h-[320px] overflow-hidden rounded-xl`}>
          <MapContainer center={centroInicial} zoom={10} scrollWheelZoom={rolagem} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AtualizarCentro centro={centroInicial} />
            <Circulos grupos={grupos} cores={cores} modo={modo} />
          </MapContainer>
          {alertas && grupos.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-lg bg-white/90 px-3 py-1 text-sm shadow">
              {noPeriodo.length ? 'Nenhuma praga selecionada.' : 'Nenhum alerta neste período.'}
            </p>
          )}
          {!alertas && (
            <p className="pointer-events-none absolute inset-x-0 top-2 z-[500] mx-auto w-fit rounded-lg bg-white/90 px-3 py-1 text-sm shadow">
              Carregando alertas…
            </p>
          )}
        </div>

        <aside aria-labelledby="titulo-alertas-recentes" className="rounded-xl bg-folha-50 p-4">
          <h3 id="titulo-alertas-recentes" className="font-bold text-folha-900">
            Últimos alertas publicados
          </h3>
          {alertas?.length ? (
            <ul className="mt-3 divide-y divide-folha-200">
              {alertas.slice(0, 5).map((alerta) => (
                <li key={alerta.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-semibold text-gray-900">{nomePraga(alerta)}</p>
                  <p className="text-sm text-gray-700">
                    {alerta.cultura ?? 'Cultura não informada'} · {alerta.municipios?.nome}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {tempoRelativo(alerta.enviado_em)}
                    {alerta.simulado && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-800">
                        demonstração
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              {alertas ? 'Ainda não há alertas publicados neste período.' : 'Consultando a lista…'}
            </p>
          )}
          {carregadoEm > 0 && (
            <p className="mt-4 border-t border-folha-200 pt-3 text-xs text-gray-500">
              Atualizado às {new Date(carregadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ·
              consulta a cada 45 s
            </p>
          )}
        </aside>
      </div>

      {erro && <p className="text-sm text-red-700">Não conseguimos carregar os alertas.</p>}

      {alertas && grupos.length > 0 && (
        <p className="text-sm text-gray-700">
          {visiveis} {visiveis === 1 ? 'alerta' : 'alertas'} · {grupos.length} {grupos.length === 1 ? 'círculo' : 'círculos'}{' '}
          · {municipios} {municipios === 1 ? 'município' : 'municípios'}
        </p>
      )}
    </div>
  )
}

function AtualizarCentro({ centro }: { centro: [number, number] }) {
  const mapa = useMap()
  useEffect(() => {
    mapa.setView(centro, mapa.getZoom())
  }, [centro, mapa])
  return null
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
    <div className="flex w-full overflow-hidden rounded-xl border border-folha-300 sm:w-auto" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onEscolher(o.valor)}
          aria-pressed={atual === o.valor}
          className={`min-h-11 min-w-0 flex-1 whitespace-nowrap px-2 text-sm font-semibold transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-folha-600 sm:flex-none sm:px-3 ${
            atual === o.valor ? 'bg-folha-700 text-white' : 'bg-white text-gray-700 hover:bg-folha-50'
          }`}
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
