// Edge Function "triagem": a IA sugere de 1 a 3 pragas do Agrofit para um chamado.
// Entrada: POST { chamado_id, aguardar? }  (chamada pelo front logo após inserir o chamado)
// Saída:
//   - padrão: 202 na hora; a triagem roda em segundo plano e a fila do especialista
//     recebe a sugestão pelo Realtime quando ela for gravada em sugestoes_ia.
//   - aguardar: true (usado no script de teste): espera e devolve a sugestão gravada.

import { createClient } from '@supabase/supabase-js'
import { encodeBase64 } from '@std/encoding/base64'
import { cabecalhosCors } from '../_shared/cors.ts'

// ---------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'
// Modelos tentados se o principal falhar (cada um tem sua própria fila no Google)
const GEMINI_MODELOS_RESERVA = (Deno.env.get('GEMINI_MODELOS_RESERVA') ?? '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)
// Nos modelos Gemini 3.x o "thinking" vem ligado (médio) e deixa a resposta lenta
const GEMINI_THINKING = Deno.env.get('GEMINI_THINKING') ?? 'low'

const TIMEOUT_TENTATIVA_MS = 45_000 // por chamada ao Gemini
const TEMPO_TOTAL_MS = 120_000 // orçamento da triagem inteira (limite do plano gratuito é 150s)
const ESPERA_NOVA_TENTATIVA_MS = 2_000
const MAX_CANDIDATAS = 3
const MAX_PRODUTOS = 10

const PROMPT_SISTEMA =
  'Você auxilia a triagem fitossanitária para um especialista humano. Analise a foto e a ' +
  'descrição de um produtor. Escolha de 1 a 3 pragas EXCLUSIVAMENTE da lista fornecida, que é ' +
  'a base oficial Agrofit do MAPA para esta cultura. Para cada uma, dê confiança de 0 a 1 e uma ' +
  'justificativa curta baseada nos sintomas visíveis. Se a foto não permitir identificação ou ' +
  "nenhuma praga da lista combinar, retorne lista vazia e explique em 'observacao'. Nunca " +
  'recomende produto nem dose. Responda só no JSON pedido.'

// Cliente com service_role: ignora RLS, por isso conferimos o dono do chamado manualmente
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

// Disponível no runtime das Edge Functions: mantém a função viva após responder
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

// ---------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------

interface Chamado {
  id: string
  produtor_id: string
  cultura: string
  descricao: string | null
  foto_path: string | null
}

interface PragaAgrofit {
  praga_nome_comum: string | null
  praga_nome_cientifico: string
}

interface Candidata {
  praga_nome_comum: string | null
  praga_nome_cientifico: string
  confianca: number
  justificativa: string
  produtos: unknown[]
}

interface RespostaIA {
  candidatas?: { praga_nome_cientifico?: string; confianca?: number; justificativa?: string }[]
  observacao?: string
}

// ---------------------------------------------------------------------
// FUNÇÕES AUXILIARES
// ---------------------------------------------------------------------

// Log em JSON, só com dados não pessoais (sem descrição, foto ou id do usuário)
function log(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ funcao: 'triagem', evento, ...dados }))
}

// Mesma normalização do script de importação: minúsculas e sem acento
function paraBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function nomeDoErro(e: unknown): string {
  if (e instanceof DOMException && e.name === 'TimeoutError') return 'timeout'
  return e instanceof Error ? e.message : 'erro_desconhecido'
}

// Sobrecarga momentânea: vale tentar o mesmo modelo de novo
function valeRepetir(erro: string): boolean {
  return erro === 'timeout' || /^gemini_http_5\d\d$/.test(erro)
}

// Baixa a foto do bucket privado e devolve em base64
async function baixarFoto(caminho: string) {
  const { data, error } = await supabase.storage.from('fotos').download(caminho)
  if (error || !data) throw new Error('foto_nao_encontrada')
  return {
    mimeType: data.type || 'image/jpeg',
    base64: encodeBase64(new Uint8Array(await data.arrayBuffer())),
  }
}

// Gemini 2.x usa thinkingBudget; Gemini 3.x usa thinkingLevel
function configThinking(modelo: string) {
  return modelo.startsWith('gemini-2.')
    ? { thinkingBudget: 0 }
    : { thinkingLevel: GEMINI_THINKING }
}

// Uma chamada ao Gemini com saída em JSON (o nome científico é um enum com a lista do Agrofit)
async function chamarGemini(
  modelo: string,
  partes: unknown[],
  responseSchema: unknown,
  timeoutMs: number,
): Promise<RespostaIA> {
  const resposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
        contents: [{ role: 'user', parts: partes }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2,
          thinkingConfig: configThinking(modelo),
          // Resolução média (560 tokens) é suficiente para foto de folha
          mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
  if (!resposta.ok) throw new Error(`gemini_http_${resposta.status}`)

  const json = await resposta.json()
  const texto: string | undefined = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!texto) throw new Error('gemini_sem_resposta')

  try {
    return JSON.parse(texto)
  } catch {
    throw new Error('gemini_json_invalido')
  }
}

// Tenta o modelo principal (com 1 repetição em sobrecarga) e depois os reservas,
// sempre dentro do orçamento TEMPO_TOTAL_MS
async function chamarComReserva(chamadoId: string, partes: unknown[], schema: unknown) {
  const prazo = Date.now() + TEMPO_TOTAL_MS
  const fila = [GEMINI_MODEL, GEMINI_MODEL, ...GEMINI_MODELOS_RESERVA]
  let ultimoErro = 'sem_tentativa'

  for (let i = 0; i < fila.length; i++) {
    const modelo = fila[i]
    const repeticao = i === 1
    // Só repete o principal se o erro anterior foi sobrecarga/timeout
    if (repeticao && !valeRepetir(ultimoErro)) continue
    if (repeticao) await new Promise((r) => setTimeout(r, ESPERA_NOVA_TENTATIVA_MS))

    const restante = prazo - Date.now()
    if (restante < 5_000) break

    const inicio = Date.now()
    try {
      const resposta = await chamarGemini(modelo, partes, schema, Math.min(TIMEOUT_TENTATIVA_MS, restante))
      log('tentativa', { chamado_id: chamadoId, modelo, ms: Date.now() - inicio, erro: null })
      return { resposta, modelo }
    } catch (e) {
      ultimoErro = nomeDoErro(e)
      log('tentativa', { chamado_id: chamadoId, modelo, ms: Date.now() - inicio, erro: ultimoErro })
    }
  }
  throw new Error(ultimoErro)
}

// Produtos registrados para cultura + praga: biológicos e orgânicos primeiro (sem dose)
async function buscarProdutos(culturaBusca: string, pragaCientifica: string) {
  const { data, error } = await supabase
    .from('agrofit_produtos')
    .select('marca_comercial, ingrediente_ativo, classe, classe_toxicologica, organico, biologico')
    .eq('cultura_busca', culturaBusca)
    .eq('praga_nome_cientifico', pragaCientifica)
    .order('biologico', { ascending: false })
    .order('organico', { ascending: false })
    .order('marca_comercial')
    .limit(MAX_PRODUTOS)
  if (error) throw new Error('erro_busca_produtos')
  return data ?? []
}

// Faz a triagem completa e devolve candidatas validadas + observação + modelo usado
async function triar(chamado: Chamado) {
  if (!GEMINI_API_KEY) throw new Error('gemini_sem_chave')
  const culturaBusca = paraBusca(chamado.cultura)

  const { data: pragas, error } = await supabase
    .from('agrofit_pragas')
    .select('praga_nome_comum, praga_nome_cientifico')
    .eq('cultura_busca', culturaBusca)
    .returns<PragaAgrofit[]>()
  if (error) throw new Error('erro_busca_pragas')
  if (!pragas?.length) throw new Error('cultura_sem_pragas_no_agrofit')

  // Monta o pedido uma vez (a foto é baixada só uma vez, mesmo com várias tentativas)
  const lista = pragas
    .map((p) => `- ${p.praga_nome_cientifico} (${p.praga_nome_comum ?? 'sem nome comum'})`)
    .join('\n')
  const texto =
    `Cultura: ${chamado.cultura}\n` +
    `Descrição do produtor: ${chamado.descricao?.trim() || '(sem descrição)'}\n\n` +
    `Lista de pragas permitidas (Agrofit/MAPA):\n${lista}`

  const partes: unknown[] = []
  if (chamado.foto_path) {
    const foto = await baixarFoto(chamado.foto_path)
    partes.push({ inlineData: { mimeType: foto.mimeType, data: foto.base64 } })
  }
  partes.push({ text: texto })

  const schema = {
    type: 'OBJECT',
    properties: {
      candidatas: {
        type: 'ARRAY',
        maxItems: MAX_CANDIDATAS,
        items: {
          type: 'OBJECT',
          properties: {
            praga_nome_cientifico: {
              type: 'STRING',
              format: 'enum',
              enum: pragas.map((p) => p.praga_nome_cientifico),
            },
            confianca: { type: 'NUMBER' },
            justificativa: { type: 'STRING' },
          },
          required: ['praga_nome_cientifico', 'confianca', 'justificativa'],
        },
      },
      observacao: { type: 'STRING' },
    },
    required: ['candidatas'],
  }

  const { resposta: ia, modelo } = await chamarComReserva(chamado.id, partes, schema)

  // Regra 2: só vale praga que está na lista do Agrofit da cultura (sem repetir)
  const porNome = new Map(pragas.map((p) => [paraBusca(p.praga_nome_cientifico), p]))
  const vistas = new Set<string>()
  const validas: Omit<Candidata, 'produtos'>[] = []
  let descartadas = 0

  for (const c of ia.candidatas ?? []) {
    const praga = porNome.get(paraBusca(c.praga_nome_cientifico ?? ''))
    if (!praga || vistas.has(praga.praga_nome_cientifico)) {
      descartadas++
      continue
    }
    vistas.add(praga.praga_nome_cientifico)
    validas.push({
      // Nomes vêm da base oficial, não do texto da IA
      praga_nome_comum: praga.praga_nome_comum,
      praga_nome_cientifico: praga.praga_nome_cientifico,
      confianca: Math.min(1, Math.max(0, Number(c.confianca) || 0)),
      justificativa: String(c.justificativa ?? '').slice(0, 500),
    })
  }

  validas.sort((a, b) => b.confianca - a.confianca)
  const candidatas: Candidata[] = await Promise.all(
    validas.slice(0, MAX_CANDIDATAS).map(async (c) => ({
      ...c,
      produtos: await buscarProdutos(culturaBusca, c.praga_nome_cientifico),
    })),
  )

  return { candidatas, observacao: ia.observacao?.slice(0, 500) ?? null, modelo, descartadas }
}

// Roda a triagem e grava o resultado. Nunca lança: falha vira o campo "erro".
async function processar(chamado: Chamado) {
  const inicio = Date.now()
  let registro: { candidatas: Candidata[]; observacao: string | null; erro: string | null; modelo: string }
  let descartadas = 0
  try {
    const r = await triar(chamado)
    registro = { candidatas: r.candidatas, observacao: r.observacao, erro: null, modelo: r.modelo }
    descartadas = r.descartadas
  } catch (e) {
    registro = { candidatas: [], observacao: null, erro: nomeDoErro(e), modelo: GEMINI_MODEL }
  }

  const { data: sugestao, error } = await supabase
    .from('sugestoes_ia')
    .insert({ chamado_id: chamado.id, ...registro })
    .select()
    .single()

  log('triagem', {
    chamado_id: chamado.id,
    cultura: paraBusca(chamado.cultura),
    modelo: registro.modelo,
    ms: Date.now() - inicio,
    candidatas: registro.candidatas.length,
    descartadas,
    erro: registro.erro,
    erro_gravar: error?.code ?? null,
  })
  return sugestao
}

// ---------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req)
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido' })

  // 1. Valida o JWT de quem chamou
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder(401, { erro: 'Sem token' })
  const { data: auth, error: erroAuth } = await supabase.auth.getUser(token)
  if (erroAuth || !auth.user) return responder(401, { erro: 'Token inválido' })

  let corpo: { chamado_id?: unknown; aguardar?: unknown } = {}
  try {
    corpo = await req.json()
  } catch {
    // corpo inválido: tratado abaixo
  }
  if (typeof corpo.chamado_id !== 'string') return responder(400, { erro: 'Informe chamado_id' })

  // Busca o chamado e confere o dono
  const { data: chamado } = await supabase
    .from('chamados')
    .select('id, produtor_id, cultura, descricao, foto_path')
    .eq('id', corpo.chamado_id)
    .maybeSingle<Chamado>()
  if (!chamado) return responder(404, { erro: 'Chamado não encontrado' })
  if (chamado.produtor_id !== auth.user.id) return responder(403, { erro: 'Chamado de outro usuário' })

  // Se já há sugestão sem erro, devolve a mesma (poupa a cota gratuita do Gemini)
  const { data: existente } = await supabase
    .from('sugestoes_ia')
    .select('*')
    .eq('chamado_id', chamado.id)
    .is('erro', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existente) {
    log('reaproveitada', { chamado_id: chamado.id })
    return responder(200, existente)
  }

  // Modo de teste: espera a triagem terminar e devolve a sugestão
  if (corpo.aguardar === true || typeof EdgeRuntime === 'undefined') {
    const sugestao = await processar(chamado)
    return sugestao ? responder(200, sugestao) : responder(500, { erro: 'Falha ao gravar a sugestão' })
  }

  // Padrão: responde na hora e processa em segundo plano
  EdgeRuntime.waitUntil(processar(chamado))
  return responder(202, { chamado_id: chamado.id, status: 'processando' })
})
