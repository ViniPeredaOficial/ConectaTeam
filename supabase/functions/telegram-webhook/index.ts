// Edge Function "telegram-webhook": cadastro de inscritos no bot do Telegram.
// Publicada com --no-verify-jwt (o Telegram não envia JWT); a segurança é o header
// X-Telegram-Bot-Api-Secret-Token, conferido contra o secret TELEGRAM_WEBHOOK_SECRET.
//
// /start           -> pergunta o município (botões da região ou digitação) e grava em inscritos_telegram
// /start <código>  -> liga a conversa à conta do produtor (aviso dos próprios chamados)
// /sair            -> remove o inscrito e desliga o aviso dos chamados

import { createClient } from '@supabase/supabase-js'
import { distanciaKm } from '../_shared/geo.ts'
import { codigoDoStart, telegram } from '../_shared/telegram.ts'
import { escaparHtml, paraBusca } from '../_shared/texto.ts'

// ---------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------

const SEGREDO = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? ''
const REGIAO_CENTRO_COD = Number(Deno.env.get('TELEGRAM_REGIAO_COD') ?? 3503208) // Araraquara
const REGIAO_RAIO_KM = Number(Deno.env.get('TELEGRAM_REGIAO_RAIO_KM') ?? 40) // cidades nos botões
const ALERTA_RAIO_KM = Number(Deno.env.get('ALERTA_RAIO_KM') ?? 15)
const MAX_OPCOES_BUSCA = 8

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

type Municipio = { cod_ibge: number; nome: string; lat: number; lon: number }

// Log sem dados pessoais (nada de chat_id, nome ou texto digitado)
function log(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ funcao: 'telegram-webhook', evento, ...dados }))
}

// Municípios ficam em memória enquanto a função estiver "quente"
let cacheMunicipios: Municipio[] | null = null
async function municipios(): Promise<Municipio[]> {
  if (!cacheMunicipios) {
    const { data, error } = await supabase.from('municipios').select('cod_ibge, nome, lat, lon')
    if (error) throw error
    cacheMunicipios = data
  }
  return cacheMunicipios
}

// Botões em 2 colunas
function teclado(lista: Municipio[]) {
  const botoes = lista.map((m) => ({ text: m.nome, callback_data: `mun:${m.cod_ibge}` }))
  const linhas = []
  for (let i = 0; i < botoes.length; i += 2) linhas.push(botoes.slice(i, i + 2))
  return { inline_keyboard: linhas }
}

function responder(chatId: number, html: string, extra: Record<string, unknown> = {}) {
  return telegram('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', ...extra })
}

// ---------------------------------------------------------------------
// AÇÕES
// ---------------------------------------------------------------------

async function boasVindas(chatId: number) {
  const todos = await municipios()
  const centro = todos.find((m) => m.cod_ibge === REGIAO_CENTRO_COD)
  const regiao = centro
    ? todos
        .map((m) => ({ m, d: distanciaKm(centro.lat, centro.lon, m.lat, m.lon) }))
        .filter((x) => x.d <= REGIAO_RAIO_KM)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.m)
    : []

  await responder(
    chatId,
    '🌱 <b>Radar de Pragas</b>\n\nReceba alertas de pragas confirmadas por especialistas perto da sua lavoura.\n\n' +
      '<b>Qual é o seu município?</b> Toque abaixo ou digite o nome da cidade (SP).',
    { reply_markup: teclado(regiao) },
  )
}

async function inscrever(chatId: number, cod: number) {
  const municipio = (await municipios()).find((m) => m.cod_ibge === cod)
  if (!municipio) return responder(chatId, 'Município não encontrado. Envie /start para escolher de novo.')

  const { error } = await supabase
    .from('inscritos_telegram')
    .upsert({ chat_id: chatId, municipio_cod: cod }, { onConflict: 'chat_id' })
  if (error) throw error

  log('inscrito', { municipio_cod: cod })
  await responder(
    chatId,
    `✅ Pronto! Você vai receber alertas de pragas de <b>${escaparHtml(municipio.nome)}</b> e arredores ` +
      `(raio de ${ALERTA_RAIO_KM} km).\n\nPara trocar de cidade, envie /start. Para parar, envie /sair.`,
  )
}

// /sair: para os alertas da região e o aviso dos próprios chamados
async function sair(chatId: number) {
  await supabase.from('inscritos_telegram').delete().eq('chat_id', chatId)
  await supabase.from('perfis').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId)
  log('saiu')
  await responder(
    chatId,
    'Você não vai mais receber alertas nem avisos dos seus chamados. Para voltar, envie /start ou ligue de novo em "Meus chamados".',
  )
}

// /start <código>: liga esta conversa à conta do produtor (link gerado em "Meus chamados")
async function ligarConta(chatId: number, codigo: string) {
  const { data: registro } = await supabase
    .from('codigos_telegram')
    .select('usuario_id, expira_em')
    .eq('codigo', codigo)
    .maybeSingle()

  if (!registro || new Date(registro.expira_em) < new Date()) {
    log('codigo_invalido')
    return responder(chatId, 'Este link expirou. Abra "Meus chamados" no Radar de Pragas e toque de novo em "Receber aviso no Telegram".')
  }

  // Uma conversa liga a uma conta só: solta qualquer ligação anterior desta conversa
  await supabase.from('perfis').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId)
  const { error } = await supabase.from('perfis').update({ telegram_chat_id: chatId }).eq('id', registro.usuario_id)
  if (error) throw error
  await supabase.from('codigos_telegram').delete().eq('codigo', codigo)

  log('conta_ligada')
  await responder(
    chatId,
    '✅ <b>Pronto!</b> Vou te avisar aqui quando seu chamado for respondido pelo especialista.\n\n' +
      'Quer receber também os alertas de pragas da sua região? Envie /start.\nPara parar tudo, envie /sair.',
  )
}

// Cidade digitada: igual (sem acento) inscreve direto; parecidas viram botões
async function buscarCidade(chatId: number, texto: string) {
  const termo = paraBusca(texto)
  if (termo.length < 3) return responder(chatId, 'Digite pelo menos 3 letras do nome da cidade, ou envie /start.')

  const todos = await municipios()
  const exato = todos.find((m) => paraBusca(m.nome) === termo)
  if (exato) return inscrever(chatId, exato.cod_ibge)

  const parecidos = todos
    .filter((m) => paraBusca(m.nome).includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (parecidos.length === 0) {
    return responder(chatId, 'Não encontrei essa cidade entre os municípios de SP. Confira o nome ou envie /start.')
  }
  if (parecidos.length > MAX_OPCOES_BUSCA) {
    return responder(chatId, `Encontrei ${parecidos.length} cidades. Digite um pouco mais do nome.`)
  }
  await responder(chatId, 'Qual destas?', { reply_markup: teclado(parecidos) })
}

// ---------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function tratar(update: any) {
  // Toque em botão de município
  const clique = update?.callback_query
  if (clique) {
    await telegram('answerCallbackQuery', { callback_query_id: clique.id })
    const chat = clique.message?.chat
    const cod = Number(String(clique.data ?? '').replace('mun:', ''))
    if (chat?.type === 'private' && cod) await inscrever(chat.id, cod)
    return
  }

  // Mensagem de texto (só conversa privada com o bot)
  const mensagem = update?.message
  if (!mensagem?.text || mensagem.chat?.type !== 'private') return
  const chatId: number = mensagem.chat.id
  const texto: string = mensagem.text.trim()
  const comando = texto.startsWith('/') ? texto.split(/[\s@]/)[0].toLowerCase() : null

  if (comando === '/start') {
    const codigo = codigoDoStart(texto)
    return codigo ? ligarConta(chatId, codigo) : boasVindas(chatId)
  }
  if (comando === '/sair') return sair(chatId)
  if (comando) return responder(chatId, 'Comandos: /start para escolher o município, /sair para parar os alertas.')
  return buscarCidade(chatId, texto)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 })

  // Só aceita chamadas do Telegram com o segredo combinado no setWebhook
  if (!SEGREDO || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SEGREDO) {
    log('segredo_invalido')
    return new Response('Não autorizado', { status: 401 })
  }

  try {
    await tratar(await req.json())
  } catch (e) {
    log('erro', { mensagem: e instanceof Error ? e.message : 'desconhecido' })
  }
  // Sempre 200: senão o Telegram reenvia a mesma atualização várias vezes
  return new Response('ok')
})
