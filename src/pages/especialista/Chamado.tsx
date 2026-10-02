import { useCallback, useEffect, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Link, useParams } from 'react-router'
import BuscaPraga from '../../components/BuscaPraga'
import type { PragaEscolhida } from '../../components/BuscaPraga'
import RecorteImagem from '../../components/RecorteImagem'
import { iconeDaCultura } from '../../lib/culturas'
import { trechoComDose } from '../../lib/dose'
import { dataHora } from '../../lib/formato'
import { recomprimirFoto, recortarFoto } from '../../lib/imagem'
import type { Recorte } from '../../lib/imagem'
import { supabase } from '../../lib/supabase'
import type { Candidata, FilaEspecialista, ImagemAlerta, Validacao } from '../../types/database'

type AlertaEnviado = { destinatarios: number; canal_enviado: boolean; enviado_em: string }

type Dados = {
  chamado: FilaEspecialista
  fotoUrl: string | null
  validacao: Validacao | null
  alerta: AlertaEnviado | null
}

// Etapas já concluídas: "tentar de novo" continua daqui, sem duplicar
type Progresso = { imagemPath?: string | null; validacaoId?: string; statusOk?: boolean }

type Resultado = { tipo: 'ok' | 'aviso'; texto: string }

async function buscarChamado(id: string): Promise<Dados> {
  const { data: chamado, error } = await supabase.from('vw_fila_especialista').select('*').eq('id', id).single()
  if (error) throw error

  const [foto, validacao] = await Promise.all([
    chamado.foto_path
      ? supabase.storage.from('fotos').createSignedUrl(chamado.foto_path, 3600)
      : Promise.resolve({ data: null }),
    supabase.from('validacoes').select('*').eq('chamado_id', id).maybeSingle(),
  ])
  const v = (validacao.data as Validacao | null) ?? null

  // Alerta já enviado para esta validação (leitura pública da tabela alertas)
  let alerta: AlertaEnviado | null = null
  if (v) {
    const { data } = await supabase
      .from('alertas')
      .select('destinatarios, canal_enviado, enviado_em')
      .eq('validacao_id', v.id)
      .maybeSingle()
    alerta = data
  }

  return { chamado: chamado as FilaEspecialista, fotoUrl: foto.data?.signedUrl ?? null, validacao: v, alerta }
}

function textoDoEnvio(destinatarios: number, canal: boolean): string {
  const contatos = `${destinatarios} ${destinatarios === 1 ? 'contato' : 'contatos'}`
  return canal
    ? `Alerta enviado para ${contatos} e o canal da região.`
    : `Alerta enviado para ${contatos}, mas o canal da região não recebeu (confira se o bot é administrador do canal).`
}

// Avisa o produtor no Telegram (se ele ligou o aviso). Não espera: a análise segue mesmo se falhar.
function avisarProdutor(chamadoId: string) {
  supabase.functions.invoke('avisar-produtor', { body: { chamado_id: chamadoId } }).then(({ error }) => {
    if (error) console.warn('Aviso ao produtor não enviado.')
  })
}

// Chama a Edge Function "alerta" e traduz o resultado para o especialista
async function enviarAlerta(validacaoId: string): Promise<Resultado> {
  const { data, error } = await supabase.functions.invoke('alerta', { body: { validacao_id: validacaoId } })
  if (!error) {
    const r = data as { destinatarios: number; canal_enviado: boolean }
    return { tipo: r.canal_enviado ? 'ok' : 'aviso', texto: textoDoEnvio(r.destinatarios, r.canal_enviado) }
  }
  if (!(error instanceof FunctionsHttpError)) {
    return { tipo: 'aviso', texto: 'Resposta salva, mas o alerta não foi enviado (sem conexão). Tente "Enviar alerta" de novo.' }
  }
  if (error.context.status === 404) {
    return { tipo: 'aviso', texto: 'Resposta salva. O alerta será enviado quando a função de alerta estiver publicada.' }
  }
  // Mensagem da função (ex.: trava de dose no servidor, alerta já enviado)
  const detalhe = ((await error.context.json().catch(() => null)) as { erro?: string } | null)?.erro ?? ''
  if (error.context.status === 409) return { tipo: 'ok', texto: detalhe || 'Este alerta já foi enviado.' }
  return { tipo: 'aviso', texto: `Resposta salva, mas o alerta não foi enviado. ${detalhe}`.trim() }
}

// Análise de um chamado pelo especialista
export default function Chamado() {
  const { id = '' } = useParams()
  const [dados, setDados] = useState<Dados | null>(null)
  const [erroCarregar, setErroCarregar] = useState(false)

  // Formulário
  const [praga, setPraga] = useState<PragaEscolhida | null>(null)
  const [comoIdentificar, setComoIdentificar] = useState('')
  const [manejo, setManejo] = useState('')
  const [imagemAlerta, setImagemAlerta] = useState<ImagemAlerta>('nenhuma')
  const [recorte, setRecorte] = useState<Recorte | null>(null)
  const [referencia, setReferencia] = useState<File | null>(null)

  // Envio
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const progresso = useRef<Progresso>({})

  const carregar = useCallback(() => {
    buscarChamado(id)
      .then((d) => {
        setDados(d)
        setErroCarregar(false)
      })
      .catch((e) => {
        console.error('Falha ao carregar chamado', e)
        setErroCarregar(true)
      })
  }, [id])

  useEffect(carregar, [carregar])

  // Se a triagem ainda está rodando, atualiza quando a sugestão da IA chegar
  useEffect(() => {
    const canal = supabase
      .channel(`chamado-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sugestoes_ia', filter: `chamado_id=eq.${id}` },
        carregar,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [id, carregar])

  if (erroCarregar) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-red-800">
        Não conseguimos abrir este chamado.{' '}
        <button className="font-semibold underline" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    )
  }
  if (!dados) return <p className="text-gray-600">Carregando...</p>

  const { chamado, fotoUrl, validacao, alerta } = dados
  const alertaSaiu = Boolean(alerta && (alerta.canal_enviado || alerta.destinatarios > 0))
  const candidatas: Candidata[] = chamado.ia_candidatas ?? []
  const doseEncontrada = trechoComDose(`${comoIdentificar}\n${manejo}`)

  function escolherCandidata(c: Candidata) {
    setPraga({ praga_nome_comum: c.praga_nome_comum, praga_nome_cientifico: c.praga_nome_cientifico })
    if (!comoIdentificar.trim()) setComoIdentificar(c.justificativa)
  }

  // Prepara a imagem do alerta e envia ao bucket público "alertas"
  async function subirImagemDoAlerta(): Promise<string | null> {
    let origem: Blob | null = null
    if (imagemAlerta === 'foto_produtor' && chamado.foto_path) {
      const { data, error } = await supabase.storage.from('fotos').download(chamado.foto_path)
      if (error) throw error
      origem = await recortarFoto(data, recorte)
    } else if (imagemAlerta === 'referencia' && referencia) {
      origem = await recomprimirFoto(referencia)
    }
    if (!origem) return null

    const caminho = `${chamado.id}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from('alertas').upload(caminho, origem, { contentType: 'image/jpeg' })
    if (error) throw error
    return caminho
  }

  async function confirmar() {
    if (!praga) return setErroEnvio('Escolha uma praga (sugestão da IA ou busca no Agrofit).')
    if (doseEncontrada) return setErroEnvio(`Retire a dose do texto ("${doseEncontrada}").`)
    if (imagemAlerta === 'referencia' && !referencia) return setErroEnvio('Escolha a imagem de referência.')

    setEnviando(true)
    setErroEnvio(null)
    try {
      // 1. Imagem do alerta
      if (progresso.current.imagemPath === undefined) {
        progresso.current.imagemPath = await subirImagemDoAlerta()
      }

      // 2. Validação (par "IA x especialista" vira dado rotulado)
      if (!progresso.current.validacaoId) {
        const primeira = candidatas[0]
        const { data, error } = await supabase
          .from('validacoes')
          .insert({
            chamado_id: chamado.id,
            praga_nome_comum: praga.praga_nome_comum,
            praga_nome_cientifico: praga.praga_nome_cientifico,
            // null quando a IA não sugeriu nada: não conta como erro da IA
            ia_acertou: primeira ? primeira.praga_nome_cientifico === praga.praga_nome_cientifico : null,
            como_identificar: comoIdentificar.trim() || null,
            manejo: manejo.trim() || null,
            imagem_alerta: progresso.current.imagemPath ? imagemAlerta : 'nenhuma',
            imagem_path: progresso.current.imagemPath,
          })
          .select('id')
          .single()
        if (error) throw error
        progresso.current.validacaoId = data.id
      }

      // 3. Status do chamado
      if (!progresso.current.statusOk) {
        const { error } = await supabase.from('chamados').update({ status: 'analisado' }).eq('id', chamado.id)
        if (error) throw error
        progresso.current.statusOk = true
        avisarProdutor(chamado.id)
      }

      // 4. Alerta (Edge Function)
      setResultado(await enviarAlerta(progresso.current.validacaoId!))
      carregar()
    } catch (e) {
      console.error('Falha ao confirmar', e)
      setErroEnvio('Não conseguimos salvar. Confira a conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  // Resposta já salva, mas o alerta não saiu (rede, função fora, bloqueio): tenta de novo
  async function reenviarAlerta() {
    if (!validacao) return
    setEnviando(true)
    setResultado(await enviarAlerta(validacao.id))
    setEnviando(false)
    carregar()
  }

  async function descartar() {
    if (!window.confirm('Descartar este chamado? Nenhum alerta será enviado.')) return
    const { error } = await supabase.from('chamados').update({ status: 'descartado' }).eq('id', chamado.id)
    if (error) return setErroEnvio('Não conseguimos descartar. Tente de novo.')
    avisarProdutor(chamado.id)
    carregar()
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/especialista" className="text-sm font-semibold text-folha-700 underline">
        ← Voltar para a fila
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ESQUERDA: o que o produtor enviou */}
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Foto enviada pelo produtor" className="max-h-[520px] w-full rounded-xl object-contain bg-gray-100" />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-gray-100 text-gray-500">Sem foto</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-folha-800">
              {iconeDaCultura(chamado.cultura)} {chamado.cultura}
            </h1>
            {chamado.simulado && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-sm font-semibold text-purple-800">simulado</span>
            )}
          </div>
          <p className="text-gray-700">
            📍 {chamado.municipio_nome ?? 'Município não informado'}
            {chamado.municipio_uf && `/${chamado.municipio_uf}`} · {dataHora(chamado.criado_em)}
          </p>
          <div className="rounded-xl bg-folha-50 p-3">
            <p className="text-sm font-semibold text-gray-600">O que o produtor viu</p>
            <p className="text-gray-900">{chamado.descricao || '(sem descrição)'}</p>
          </div>
        </section>

        {/* DIREITA: IA + resposta */}
        <section className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-folha-800">Sugestões da IA</h2>
            <SugestoesIA
              chamado={chamado}
              candidatas={candidatas}
              escolhida={praga?.praga_nome_cientifico}
              podeEscolher={!validacao && chamado.status === 'em_analise'}
              onEscolher={escolherCandidata}
            />
          </div>

          {validacao ? (
            <>
              <RespostaDada validacao={validacao} />
              {chamado.simulado && alerta ? (
                // Demonstração: nunca dispara alerta falso no canal real
                <p className="rounded-xl bg-purple-50 p-3 text-purple-900">
                  🧪 Alerta simulado ({dataHora(alerta.enviado_em)}): não enviado ao Telegram.
                </p>
              ) : alertaSaiu && alerta ? (
                <p className="rounded-xl bg-folha-100 p-3 text-folha-800">
                  📣 {dataHora(alerta.enviado_em)}: {textoDoEnvio(alerta.destinatarios, alerta.canal_enviado)}
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-amber-900">
                  <span>O alerta desta resposta ainda não foi enviado.</span>
                  <button
                    onClick={reenviarAlerta}
                    disabled={enviando}
                    className="min-h-10 shrink-0 rounded-lg bg-folha-600 px-4 font-semibold text-white disabled:opacity-50"
                  >
                    {enviando ? 'Enviando...' : 'Enviar alerta'}
                  </button>
                </div>
              )}
            </>
          ) : chamado.status === 'descartado' ? (
            <div className="rounded-2xl bg-gray-100 p-5 text-gray-700">Este chamado foi descartado.</div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-folha-800">Sua resposta</h2>

              <div>
                <p className="mb-1 text-sm font-semibold text-gray-700">Praga confirmada</p>
                {praga ? (
                  <p className="rounded-lg bg-folha-50 p-2">
                    <strong>{praga.praga_nome_comum ?? '(sem nome comum)'}</strong>{' '}
                    <em className="text-gray-600">{praga.praga_nome_cientifico}</em>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">Escolha uma sugestão acima ou busque outra praga:</p>
                )}
                <div className="mt-2">
                  <BuscaPraga cultura={chamado.cultura} onEscolher={setPraga} />
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-700">Como identificar</span>
                <textarea
                  rows={3}
                  value={comoIdentificar}
                  onChange={(e) => setComoIdentificar(e.target.value)}
                  className="rounded-lg border-2 border-gray-200 p-2 focus:border-folha-500 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-700">Manejo recomendado</span>
                <textarea
                  rows={4}
                  value={manejo}
                  onChange={(e) => setManejo(e.target.value)}
                  placeholder="Ex.: monitorar 2 vezes por semana, retirar folhas atacadas, usar produto biológico registrado..."
                  className="rounded-lg border-2 border-gray-200 p-2 focus:border-folha-500 focus:outline-none"
                />
              </label>

              {/* Imagem do alerta */}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-gray-700">Imagem do alerta</legend>
                <div className="flex flex-wrap gap-4">
                  {(
                    [
                      ['foto_produtor', 'Foto do produtor'],
                      ['referencia', 'Imagem de referência'],
                      ['nenhuma', 'Nenhuma'],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <label key={valor} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="imagem"
                        checked={imagemAlerta === valor}
                        disabled={valor === 'foto_produtor' && !fotoUrl}
                        onChange={() => setImagemAlerta(valor)}
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
                {imagemAlerta === 'foto_produtor' && fotoUrl && (
                  <RecorteImagem src={fotoUrl} recorte={recorte} onChange={setRecorte} />
                )}
                {imagemAlerta === 'referencia' && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReferencia(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                )}
              </fieldset>

              {/* Aviso fixo sobre dose (regra 4) */}
              <p className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
                O alerta não pode conter dose. Indique os produtos registrados e oriente procurar a assistência técnica.
              </p>
              {doseEncontrada && (
                <p className="text-sm font-semibold text-red-700">
                  Parece haver uma dose no texto: “{doseEncontrada}”. Retire antes de enviar.
                </p>
              )}

              {erroEnvio && (
                <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-800">
                  {erroEnvio}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={confirmar}
                  disabled={enviando || !praga || Boolean(doseEncontrada)}
                  className="min-h-12 flex-1 rounded-xl bg-folha-600 font-semibold text-white hover:bg-folha-700 disabled:opacity-50"
                >
                  {enviando ? 'Enviando...' : 'Confirmar e enviar alerta'}
                </button>
                <button
                  onClick={descartar}
                  disabled={enviando}
                  className="min-h-12 rounded-xl border-2 border-gray-300 px-4 font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Descartar chamado
                </button>
              </div>
            </div>
          )}

          {resultado && (
            <p
              role="status"
              className={`rounded-xl p-3 font-semibold ${
                resultado.tipo === 'ok' ? 'bg-folha-100 text-folha-800' : 'bg-amber-50 text-amber-900'
              }`}
            >
              {resultado.texto}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

// Candidatas da IA com barra de confiança e produtos registrados
function SugestoesIA({
  chamado,
  candidatas,
  escolhida,
  podeEscolher,
  onEscolher,
}: {
  chamado: FilaEspecialista
  candidatas: Candidata[]
  escolhida?: string
  podeEscolher: boolean
  onEscolher: (c: Candidata) => void
}) {
  if (!chamado.ia_criado_em) return <p className="text-gray-600">Triagem em andamento… esta área atualiza sozinha.</p>
  if (chamado.ia_erro) return <p className="font-semibold text-amber-800">Triagem automática indisponível.</p>
  if (candidatas.length === 0) {
    return (
      <p className="text-gray-700">
        A IA não identificou uma praga da lista.{chamado.ia_observacao && <> Observação: {chamado.ia_observacao}</>}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {candidatas.map((c, i) => (
        <div
          key={c.praga_nome_cientifico}
          className={`rounded-xl border-2 p-3 ${escolhida === c.praga_nome_cientifico ? 'border-folha-600' : 'border-gray-200'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold">
                {i + 1}. {c.praga_nome_comum ?? c.praga_nome_cientifico}
              </p>
              <p className="text-sm italic text-gray-600">{c.praga_nome_cientifico}</p>
            </div>
            {podeEscolher && (
              <button
                onClick={() => onEscolher(c)}
                className="shrink-0 rounded-lg bg-folha-600 px-3 py-1 text-sm font-semibold text-white hover:bg-folha-700"
              >
                {escolhida === c.praga_nome_cientifico ? 'Escolhida' : 'Usar esta'}
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-folha-500" style={{ width: `${Math.round(c.confianca * 100)}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold">{Math.round(c.confianca * 100)}%</span>
          </div>
          <p className="mt-2 text-sm text-gray-800">{c.justificativa}</p>

          {c.produtos.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-folha-700">
                Produtos registrados no Agrofit ({c.produtos.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {c.produtos.map((p, j) => (
                  <li key={`${p.marca_comercial}-${j}`} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.marca_comercial}</span>
                    {p.biologico && (
                      <span className="rounded-full bg-folha-100 px-2 text-xs font-semibold text-folha-800">biológico</span>
                    )}
                    {p.organico && (
                      <span className="rounded-full bg-lime-100 px-2 text-xs font-semibold text-lime-800">orgânico</span>
                    )}
                    <span className="text-gray-600">{p.ingrediente_ativo}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
      {chamado.ia_observacao && <p className="text-sm text-gray-600">Observação da IA: {chamado.ia_observacao}</p>}
    </div>
  )
}

// Resposta já enviada (só leitura)
function RespostaDada({ validacao }: { validacao: Validacao }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-folha-800">Resposta enviada</h2>
      <p className="mt-2">
        <strong>{validacao.praga_nome_comum ?? validacao.praga_nome_cientifico}</strong>{' '}
        <em className="text-gray-600">{validacao.praga_nome_cientifico}</em>
      </p>
      <p className="text-sm text-gray-600">
        {validacao.ia_acertou === null ? 'A IA não sugeriu' : validacao.ia_acertou ? 'A IA acertou' : 'A IA errou'} ·{' '}
        {dataHora(validacao.criado_em)}
      </p>
      {validacao.como_identificar && (
        <>
          <h3 className="mt-3 font-semibold">Como identificar</h3>
          <p>{validacao.como_identificar}</p>
        </>
      )}
      {validacao.manejo && (
        <>
          <h3 className="mt-3 font-semibold">Manejo recomendado</h3>
          <p>{validacao.manejo}</p>
        </>
      )}
    </div>
  )
}
