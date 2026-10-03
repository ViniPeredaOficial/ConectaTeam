import { useCallback, useEffect, useState } from 'react'
import AvisoTelegram from '../../components/AvisoTelegram'
import BotaoGrande from '../../components/BotaoGrande'
import BotaoVoltar from '../../components/BotaoVoltar'
import FotoAmpliavel from '../../components/FotoAmpliavel'
import { iconeDaCultura } from '../../lib/culturas'
import { supabase } from '../../lib/supabase'
import { useTitulo } from '../../lib/titulo'
import type { StatusChamado } from '../../types/database'

// Resposta do especialista que o produtor pode ler (RLS: só dos próprios chamados)
type Resposta = {
  praga_nome_comum: string | null
  praga_nome_cientifico: string
  como_identificar: string | null
  manejo: string | null
}

type ChamadoDoProdutor = {
  id: string
  cultura: string
  descricao: string | null
  foto_path: string | null
  status: StatusChamado
  simulado: boolean
  criado_em: string
  municipios: { nome: string } | null
  validacoes: Resposta | Resposta[] | null
  fotoUrl?: string
}

const SELOS: Record<StatusChamado, { texto: string; classes: string }> = {
  em_analise: { texto: 'Em análise', classes: 'bg-amber-100 text-amber-900' },
  analisado: { texto: 'Analisado', classes: 'bg-folha-100 text-folha-800' },
  descartado: { texto: 'Encerrado', classes: 'bg-gray-200 text-gray-700' },
}

// A relação 1:1 pode vir como objeto ou lista, dependendo do PostgREST
function primeiraResposta(v: ChamadoDoProdutor['validacoes']): Resposta | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Busca os chamados do usuário logado, já com a URL assinada da miniatura
async function buscarMeusChamados(): Promise<{ usuario: string | null; lista: ChamadoDoProdutor[] }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { usuario: null, lista: [] }

  const { data, error } = await supabase
    .from('chamados')
    .select(
      'id, cultura, descricao, foto_path, status, simulado, criado_em, municipios(nome), ' +
        'validacoes(praga_nome_comum, praga_nome_cientifico, como_identificar, manejo)',
    )
    .eq('produtor_id', session.user.id) // mesmo se a conta for de especialista, só os próprios
    .order('criado_em', { ascending: false })
    .returns<ChamadoDoProdutor[]>()
  if (error) throw error

  // Miniaturas: URLs assinadas do bucket privado (válidas por 1 hora)
  const caminhos = data.map((c) => c.foto_path).filter((p): p is string => Boolean(p))
  const urls: Record<string, string> = {}
  if (caminhos.length) {
    const { data: assinadas } = await supabase.storage.from('fotos').createSignedUrls(caminhos, 3600)
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls[a.path] = a.signedUrl
  }

  return {
    usuario: session.user.id,
    lista: data.map((c) => ({ ...c, fotoUrl: c.foto_path ? urls[c.foto_path] : undefined })),
  }
}

// Lista dos chamados do produtor, atualizada ao vivo quando o especialista responde
export default function MeusChamados() {
  useTitulo('Meus chamados')
  const [chamados, setChamados] = useState<ChamadoDoProdutor[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  // O estado só muda quando a resposta chega
  const carregar = useCallback(() => {
    buscarMeusChamados()
      .then(({ usuario, lista }) => {
        setUsuarioId(usuario)
        setChamados(lista)
        setErro(false)
      })
      .catch((e) => {
        console.error('Falha ao carregar chamados', e)
        setErro(true)
      })
      .finally(() => setCarregando(false))
  }, [])

  useEffect(carregar, [carregar])

  // Realtime: quando o especialista muda o status de um chamado meu, recarrega a lista
  useEffect(() => {
    if (!usuarioId) return
    const canal = supabase
      .channel('meus-chamados')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chamados', filter: `produtor_id=eq.${usuarioId}` },
        () => carregar(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [usuarioId, carregar])

  if (carregando) {
    return (
      <div role="status" className="mx-auto max-w-2xl animate-pulse">
        <span className="sr-only">Carregando seus chamados...</span>
        <div className="h-8 w-48 rounded-lg bg-folha-200" />
        <div className="mt-5 h-24 rounded-2xl bg-white" />
        <div className="mt-4 h-36 rounded-2xl bg-white" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <BotaoVoltar para="/" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-folha-900">Meus chamados</h1>
        <p className="mt-1 text-sm text-gray-600">Acompanhe a análise e as respostas dos problemas que você reportou.</p>
      </div>
      <AvisoTelegram />

      {erro && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Não conseguimos carregar seus chamados.{' '}
          <button className="font-semibold underline" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {!erro && chamados.length === 0 && (
        <div className="rounded-2xl border border-folha-200 bg-white px-5 py-8 text-center">
          <h2 className="text-lg font-bold text-folha-900">Nenhum chamado por enquanto</h2>
          <p className="mt-2 text-sm text-gray-600">Quando você reportar um problema, poderá acompanhar a análise aqui.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {chamados.map((c) => {
          const selo = SELOS[c.status]
          const resposta = primeiraResposta(c.validacoes)
          return (
            <article key={c.id} className="rounded-2xl border border-folha-200 bg-white p-4 sm:p-5">
              <div className="flex gap-3">
                {c.fotoUrl ? (
                  <div className="h-20 w-20 shrink-0">
                    <FotoAmpliavel
                      src={c.fotoUrl}
                      alt={`Foto do chamado de ${c.cultura}`}
                      className="h-20 w-20 rounded-xl object-cover"
                      mostrarSelo={false}
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-folha-50 text-3xl">
                    {iconeDaCultura(c.cultura)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selo.classes}`}>
                      {selo.texto}
                    </span>
                    {c.simulado && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                        demonstração
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">
                    {iconeDaCultura(c.cultura)} {c.cultura}
                    {c.municipios?.nome && <span className="font-normal text-gray-600"> · {c.municipios.nome}</span>}
                  </p>
                  <p className="text-sm text-gray-500">Enviado em {formatarData(c.criado_em)}</p>
                </div>
              </div>

              {c.descricao && <p className="mt-3 text-sm leading-relaxed text-gray-700">“{c.descricao}”</p>}

              {c.status === 'em_analise' && (
                <p role="status" className="mt-3 border-t border-folha-100 pt-3 text-sm text-gray-600">
                  Aguardando o especialista. Esta tela atualiza sozinha.
                </p>
              )}

              {c.status === 'analisado' && resposta && (
                <div className="mt-4 rounded-xl border border-folha-100 bg-folha-50 p-4">
                  <p className="text-lg font-bold text-folha-900">
                    {resposta.praga_nome_comum ?? resposta.praga_nome_cientifico}
                  </p>
                  <p className="text-sm italic text-gray-600">{resposta.praga_nome_cientifico}</p>
                  {resposta.como_identificar && (
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-gray-900">Como identificar</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-800">{resposta.como_identificar}</p>
                    </div>
                  )}
                  {resposta.manejo && (
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold text-gray-900">Manejo</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-800">{resposta.manejo}</p>
                    </div>
                  )}
                  <p className="mt-3 border-t border-folha-200 pt-3 text-sm font-semibold text-amber-900">
                    Procure a assistência técnica (CATI) antes de aplicar qualquer produto.
                  </p>
                </div>
              )}

              {c.status === 'descartado' && (
                <p className="mt-3 border-t border-folha-100 pt-3 text-sm text-gray-600">
                  O especialista encerrou este chamado. Se o problema continuar, envie uma nova foto.
                </p>
              )}
            </article>
          )
        })}
      </div>

      <div className="pt-1">
        <BotaoGrande to="/produtor">Reportar novo problema</BotaoGrande>
      </div>
    </div>
  )
}
