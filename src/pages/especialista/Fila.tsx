import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { iconeDaCultura } from '../../lib/culturas'
import { tempoDesde } from '../../lib/formato'
import { supabase } from '../../lib/supabase'
import type { FilaEspecialista } from '../../types/database'

type ItemFila = FilaEspecialista & { fotoUrl?: string }
type Contadores = { emAnalise: number; analisadosHoje: number; taxaAcerto: number | null }

const DESTAQUE_MS = 8_000

// O Leaflet só é baixado quando a aba do mapa é aberta
const MapaAlertas = lazy(() => import('../../components/MapaAlertas'))

// Em análise primeiro (mais antigos no topo); depois os já tratados (mais recentes primeiro)
function ordenar(itens: ItemFila[]): ItemFila[] {
  const emAnalise = itens.filter((i) => i.status === 'em_analise').sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  const outros = itens.filter((i) => i.status !== 'em_analise').sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  return [...emAnalise, ...outros]
}

async function buscarFila(): Promise<{ itens: ItemFila[]; contadores: Contadores }> {
  const [fila, validacoes] = await Promise.all([
    supabase.from('vw_fila_especialista').select('*').order('criado_em', { ascending: false }).limit(300),
    supabase.from('validacoes').select('ia_acertou, criado_em'),
  ])
  if (fila.error) throw fila.error
  if (validacoes.error) throw validacoes.error

  // Miniaturas: URLs assinadas do bucket privado
  const itens = fila.data as ItemFila[]
  const caminhos = itens.map((i) => i.foto_path).filter((p): p is string => Boolean(p))
  if (caminhos.length) {
    const { data } = await supabase.storage.from('fotos').createSignedUrls(caminhos, 3600)
    const urls = new Map((data ?? []).map((a) => [a.path, a.signedUrl]))
    for (const i of itens) if (i.foto_path) i.fotoUrl = urls.get(i.foto_path) ?? undefined
  }

  // Contadores: taxa de acerto só onde a IA opinou (ia_acertou não nulo)
  const inicioDoDia = new Date()
  inicioDoDia.setHours(0, 0, 0, 0)
  const opinou = validacoes.data.filter((v) => v.ia_acertou !== null)
  return {
    itens: ordenar(itens),
    contadores: {
      emAnalise: itens.filter((i) => i.status === 'em_analise').length,
      analisadosHoje: validacoes.data.filter((v) => new Date(v.criado_em) >= inicioDoDia).length,
      taxaAcerto: opinou.length ? opinou.filter((v) => v.ia_acertou).length / opinou.length : null,
    },
  }
}

// Bip curto gerado no navegador (sem arquivo de áudio)
function tocarBip() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const volume = ctx.createGain()
  osc.frequency.value = 880
  volume.gain.setValueAtTime(0.15, ctx.currentTime)
  volume.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc.connect(volume).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.25)
  osc.onended = () => ctx.close()
}

// Fila de chamados do especialista, atualizada ao vivo
export default function Fila() {
  const [itens, setItens] = useState<ItemFila[]>([])
  const [contadores, setContadores] = useState<Contadores | null>(null)
  const [erro, setErro] = useState(false)
  const [destaques, setDestaques] = useState<Set<string>>(new Set())
  const [som, setSom] = useState(false)
  const [parametros, setParametros] = useSearchParams()
  const aba = parametros.get('aba') === 'mapa' ? 'mapa' : 'fila'
  // O canal do Realtime lê o valor atual do som sem precisar ser recriado
  const somLigado = useRef(som)
  useEffect(() => {
    somLigado.current = som
  }, [som])

  const carregar = useCallback(() => {
    buscarFila()
      .then((r) => {
        setItens(r.itens)
        setContadores(r.contadores)
        setErro(false)
      })
      .catch((e) => {
        console.error('Falha ao carregar a fila', e)
        setErro(true)
      })
  }, [])

  useEffect(carregar, [carregar])

  // Realtime: chamado novo entra com destaque; mudanças e sugestões da IA recarregam a fila
  useEffect(() => {
    const canal = supabase
      .channel('fila-especialista')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamados' }, (msg) => {
        const id = (msg.new as { id: string }).id
        setDestaques((d) => new Set(d).add(id))
        setTimeout(() => setDestaques((d) => {
          const novo = new Set(d)
          novo.delete(id)
          return novo
        }), DESTAQUE_MS)
        if (somLigado.current) tocarBip()
        carregar()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chamados' }, carregar)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sugestoes_ia' }, carregar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregar])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {/* Abas: a escolhida fica na URL (?aba=mapa) */}
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
          {(
            [
              ['fila', 'Fila de chamados'],
              ['mapa', 'Mapa de alertas'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              role="tab"
              aria-selected={aba === valor}
              onClick={() => setParametros(valor === 'mapa' ? { aba: 'mapa' } : {})}
              className={`rounded-lg px-4 py-2 text-lg font-bold ${
                aba === valor ? 'bg-folha-600 text-white' : 'text-folha-800 hover:bg-folha-50'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSom((s) => !s)}
          className="rounded-lg border px-3 py-1 text-sm"
          title="Tocar um som quando chegar chamado novo"
        >
          {som ? '🔔 Som ligado' : '🔕 Som desligado'}
        </button>
      </div>

      {aba === 'mapa' ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <Suspense fallback={<div className="h-[600px] animate-pulse rounded-xl bg-gray-100" />}>
            <MapaAlertas altura="h-[600px]" rolagem />
          </Suspense>
        </section>
      ) : (
        <ConteudoFila
          itens={itens}
          contadores={contadores}
          erro={erro}
          destaques={destaques}
          onTentarDeNovo={carregar}
        />
      )}
    </div>
  )
}

type PropsConteudo = {
  itens: ItemFila[]
  contadores: Contadores | null
  erro: boolean
  destaques: Set<string>
  onTentarDeNovo: () => void
}

// Contadores + lista de chamados (aba "Fila")
function ConteudoFila({ itens, contadores, erro, destaques, onTentarDeNovo }: PropsConteudo) {
  return (
    <>
      {/* Contadores */}
      <div className="grid grid-cols-3 gap-4">
        <Contador rotulo="Em análise" valor={contadores ? String(contadores.emAnalise) : '…'} />
        <Contador rotulo="Analisados hoje" valor={contadores ? String(contadores.analisadosHoje) : '…'} />
        <Contador
          rotulo="Acerto da IA (1ª sugestão)"
          valor={
            !contadores ? '…' : contadores.taxaAcerto === null ? '—' : `${Math.round(contadores.taxaAcerto * 100)}%`
          }
        />
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 p-3 text-red-800">
          Não conseguimos carregar a fila.{' '}
          <button className="font-semibold underline" onClick={onTentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      )}

      {!erro && contadores && itens.length === 0 && <p className="text-gray-600">Nenhum chamado ainda.</p>}

      <ul className="flex flex-col gap-2">
        {itens.map((i) => (
          <li key={i.id}>
            <ItemDaFila item={i} destaque={destaques.has(i.id)} />
          </li>
        ))}
      </ul>
    </>
  )
}

function Contador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-600">{rotulo}</p>
      <p className="text-3xl font-bold text-folha-800">{valor}</p>
    </div>
  )
}

function ItemDaFila({ item, destaque }: { item: ItemFila; destaque: boolean }) {
  const principal = item.ia_candidatas?.[0]
  const tratado = item.status !== 'em_analise'

  let ia
  if (principal) {
    ia = (
      <span>
        <strong>{principal.praga_nome_comum ?? principal.praga_nome_cientifico}</strong>{' '}
        <span className="text-gray-600">{Math.round(principal.confianca * 100)}%</span>
      </span>
    )
  } else if (item.ia_erro) {
    ia = <span className="text-amber-800">IA indisponível</span>
  } else if (item.ia_criado_em) {
    ia = <span className="text-gray-600">IA não identificou</span>
  } else {
    ia = <span className="text-gray-500">Triagem em andamento…</span>
  }

  return (
    <Link
      to={`/especialista/chamado/${item.id}`}
      className={`grid grid-cols-[64px_1fr_1fr_auto] items-center gap-4 rounded-xl bg-white p-3 shadow-sm transition hover:bg-folha-50 ${
        destaque ? 'ring-4 ring-amber-400' : ''
      } ${tratado ? 'opacity-60' : ''}`}
    >
      {item.fotoUrl ? (
        <img src={item.fotoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-folha-50 text-2xl">
          {iconeDaCultura(item.cultura)}
        </div>
      )}
      <div>
        <p className="font-semibold">
          {iconeDaCultura(item.cultura)} {item.cultura} · {item.municipio_nome ?? 'Município não informado'}
        </p>
        <p className="text-sm text-gray-600">{tempoDesde(item.criado_em)}</p>
      </div>
      <div className="text-sm">{ia}</div>
      <div className="flex items-center gap-2">
        {item.simulado && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">simulado</span>
        )}
        {destaque && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">novo</span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.status === 'em_analise'
              ? 'bg-amber-100 text-amber-900'
              : item.status === 'analisado'
                ? 'bg-folha-100 text-folha-800'
                : 'bg-gray-200 text-gray-700'
          }`}
        >
          {item.status === 'em_analise' ? 'Em análise' : item.status === 'analisado' ? 'Analisado' : 'Descartado'}
        </span>
      </div>
    </Link>
  )
}
