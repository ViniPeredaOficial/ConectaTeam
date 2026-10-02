// Edge Function "alerta": envia o alerta regional no Telegram depois da validação do especialista.
// Entrada: POST { validacao_id }  (só especialista)
// Saída:   { alerta_id, destinatarios, canal_enviado }

import { createClient } from '@supabase/supabase-js'
import { cabecalhosCors } from '../_shared/cors.ts'
import { trechoComDose } from '../_shared/dose.ts'
import { distanciaKm } from '../_shared/geo.ts'
import { telegram, telegramConfigurado } from '../_shared/telegram.ts'
import { paraBusca } from '../_shared/texto.ts'
import { montarMensagem, nomesDeProdutos } from './mensagem.ts'

// ---------------------------------------------------------------------
// CONFIGURAÇÃO
// ---------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const CANAL_ID = Deno.env.get('TELEGRAM_CANAL_ID') ?? ''
const RAIO_KM = Number(Deno.env.get('ALERTA_RAIO_KM') ?? 15)
const LIMITE_LEGENDA = 1024 // limite do Telegram para legenda de foto
const PAUSA_ENTRE_ENVIOS_MS = 50 // fica abaixo do limite de ~30 mensagens/s do Telegram

// Cliente com service_role: lê inscritos_telegram e grava em alertas
const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

// Log em JSON, sem dados pessoais (nada de chat_id, nome ou texto do produtor)
function log(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ funcao: 'alerta', evento, ...dados }))
}

// Envia o alerta para um destino: foto com legenda, foto + texto, ou só texto
async function enviarPara(chatId: string | number, html: string, tamanhoTexto: number, imagemUrl: string | null) {
  if (imagemUrl) {
    if (tamanhoTexto <= LIMITE_LEGENDA) {
      return (await telegram('sendPhoto', { chat_id: chatId, photo: imagemUrl, caption: html, parse_mode: 'HTML' })).ok
    }
    // Legenda grande demais: foto primeiro, texto em seguida
    const foto = await telegram('sendPhoto', { chat_id: chatId, photo: imagemUrl })
    if (!foto.ok) return false
  }
  const r = await telegram('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  })
  return r.ok
}

// ---------------------------------------------------------------------
// HANDLER
// ---------------------------------------------------------------------

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req)
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido' })

  // Só especialista
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder(401, { erro: 'Sem token' })
  const { data: auth } = await supabase.auth.getUser(token)
  if (!auth?.user) return responder(401, { erro: 'Token inválido' })
  const { data: perfil } = await supabase.from('perfis').select('papel').eq('id', auth.user.id).maybeSingle()
  if (perfil?.papel !== 'especialista') return responder(403, { erro: 'Acesso restrito a especialistas' })

  if (!telegramConfigurado() || !CANAL_ID) {
    return responder(503, { erro: 'Telegram não configurado (secrets TELEGRAM_BOT_TOKEN e TELEGRAM_CANAL_ID).' })
  }

  let validacaoId: unknown
  try {
    validacaoId = (await req.json())?.validacao_id
  } catch {
    // tratado abaixo
  }
  if (typeof validacaoId !== 'string') return responder(400, { erro: 'Informe validacao_id' })

  // Validação + chamado
  const { data: validacao } = await supabase.from('validacoes').select('*').eq('id', validacaoId).maybeSingle()
  if (!validacao) return responder(404, { erro: 'Validação não encontrada' })

  const { data: chamado } = await supabase
    .from('chamados')
    .select('id, cultura, municipio_cod, simulado')
    .eq('id', validacao.chamado_id)
    .single()
  if (!chamado?.municipio_cod) return responder(422, { erro: 'Chamado sem município: não dá para calcular a região.' })

  // Alerta já enviado? (um por validação). Um registro sem nenhum envio pode ser reaproveitado.
  const { data: existente } = await supabase
    .from('alertas')
    .select('id, destinatarios, canal_enviado')
    .eq('validacao_id', validacaoId)
    .maybeSingle()
  if (existente && (existente.canal_enviado || existente.destinatarios > 0)) {
    return responder(409, { erro: 'Este alerta já foi enviado.', ...existente })
  }

  // Trava de segurança: nada de dose no texto do especialista (regra 4)
  const dose = trechoComDose(`${validacao.como_identificar ?? ''}\n${validacao.manejo ?? ''}`)
  if (dose) {
    log('recusado_dose', { validacao_id: validacaoId })
    return responder(422, { erro: `O texto tem uma dose ("${dose}"). Revise antes de enviar o alerta.` })
  }

  // Municípios no raio (entre centroides; nunca a coordenada do produtor)
  const { data: municipios } = await supabase.from('municipios').select('cod_ibge, nome, lat, lon')
  const origem = municipios?.find((m) => m.cod_ibge === chamado.municipio_cod)
  if (!municipios || !origem) return responder(422, { erro: 'Município do chamado não encontrado.' })
  const codsNoRaio = municipios
    .filter((m) => distanciaKm(origem.lat, origem.lon, m.lat, m.lon) <= RAIO_KM)
    .map((m) => m.cod_ibge)

  // Até 5 produtos registrados para cultura + praga, biológicos e orgânicos primeiro
  const { data: produtos } = await supabase
    .from('agrofit_produtos')
    .select('marca_comercial')
    .eq('cultura_busca', paraBusca(chamado.cultura))
    .eq('praga_nome_cientifico', validacao.praga_nome_cientifico)
    .order('biologico', { ascending: false })
    .order('organico', { ascending: false })
    .order('marca_comercial')
    .limit(20)

  const mensagem = montarMensagem({
    pragaComum: validacao.praga_nome_comum,
    pragaCientifica: validacao.praga_nome_cientifico,
    municipio: origem.nome,
    raioKm: RAIO_KM,
    cultura: chamado.cultura,
    comoIdentificar: validacao.como_identificar,
    manejo: validacao.manejo,
    produtos: nomesDeProdutos((produtos ?? []).map((p) => p.marca_comercial)),
    simulado: chamado.simulado,
  })
  const imagemUrl = validacao.imagem_path
    ? `${SUPABASE_URL}/storage/v1/object/public/alertas/${validacao.imagem_path}`
    : null

  // Reserva o registro ANTES de enviar: a constraint única impede envio duplicado em paralelo
  const registro = {
    validacao_id: validacaoId,
    municipio_cod: chamado.municipio_cod,
    raio_km: RAIO_KM,
    titulo: mensagem.titulo,
    texto: mensagem.texto,
    imagem_url: imagemUrl,
    simulado: chamado.simulado,
    // Para o mapa público (que não lê validacoes)
    cultura: chamado.cultura,
    praga_nome_comum: validacao.praga_nome_comum,
    praga_nome_cientifico: validacao.praga_nome_cientifico,
  }
  let alertaId = existente?.id as string | undefined
  if (alertaId) {
    // Tentativa anterior não chegou a ninguém: atualiza o conteúdo e envia de novo
    await supabase.from('alertas').update(registro).eq('id', alertaId)
  } else {
    const { data: novo, error } = await supabase.from('alertas').insert(registro).select('id').single()
    if (error?.code === '23505') return responder(409, { erro: 'Este alerta já está sendo enviado.' })
    if (error) {
      log('erro_gravar', { validacao_id: validacaoId, codigo: error.code })
      return responder(500, { erro: 'Falha ao registrar o alerta.' })
    }
    alertaId = novo.id
  }

  // Envio: canal da região + inscritos dos municípios no raio
  const inicio = Date.now()
  const canalEnviado = await enviarPara(CANAL_ID, mensagem.html, mensagem.texto.length, imagemUrl)

  const { data: inscritos } = await supabase
    .from('inscritos_telegram')
    .select('chat_id')
    .in('municipio_cod', codsNoRaio)

  let destinatarios = 0
  for (const inscrito of inscritos ?? []) {
    await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ENVIOS_MS))
    if (await enviarPara(inscrito.chat_id, mensagem.html, mensagem.texto.length, imagemUrl)) destinatarios++
  }

  await supabase
    .from('alertas')
    .update({ destinatarios, canal_enviado: canalEnviado, enviado_em: new Date().toISOString() })
    .eq('id', alertaId)

  log('enviado', {
    alerta_id: alertaId,
    municipios_no_raio: codsNoRaio.length,
    inscritos: inscritos?.length ?? 0,
    destinatarios,
    canal_enviado: canalEnviado,
    com_imagem: Boolean(imagemUrl),
    ms: Date.now() - inicio,
  })

  return responder(200, { alerta_id: alertaId, destinatarios, canal_enviado: canalEnviado })
})
