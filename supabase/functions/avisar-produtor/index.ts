// Edge Function "avisar-produtor": mensagem particular no Telegram ao produtor
// quando o especialista responde (analisado) ou encerra (descartado) o chamado.
// Entrada: POST { chamado_id }  (só especialista)
// Saída:   { avisado: boolean, motivo?: string }

import { createClient } from '@supabase/supabase-js'
import { cabecalhosCors } from '../_shared/cors.ts'
import { telegram, telegramConfigurado } from '../_shared/telegram.ts'
import { mensagemAoProdutor } from './mensagem.ts'

const URL_APP = (Deno.env.get('APP_URL') ?? 'https://conectateam.vercel.app').replace(/\/$/, '')

// service_role: lê o chat do produtor (que o especialista não pode ver)
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

// Log sem dados pessoais (nada de chat_id nem produtor_id)
function log(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ funcao: 'avisar-produtor', evento, ...dados }))
}

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

  let chamadoId: unknown
  try {
    chamadoId = (await req.json())?.chamado_id
  } catch {
    // tratado abaixo
  }
  if (typeof chamadoId !== 'string') return responder(400, { erro: 'Informe chamado_id' })

  const { data: chamado } = await supabase
    .from('chamados')
    .select('id, cultura, status, simulado, criado_em, produtor_id, produtor_avisado_em')
    .eq('id', chamadoId)
    .maybeSingle()
  if (!chamado) return responder(404, { erro: 'Chamado não encontrado' })

  // Casos em que não há aviso (não são erro)
  if (chamado.simulado) return responder(200, { avisado: false, motivo: 'simulado' })
  if (chamado.status === 'em_analise') return responder(200, { avisado: false, motivo: 'ainda_em_analise' })
  if (chamado.produtor_avisado_em) return responder(200, { avisado: false, motivo: 'ja_avisado' })

  const { data: dono } = await supabase
    .from('perfis')
    .select('telegram_chat_id')
    .eq('id', chamado.produtor_id)
    .maybeSingle()
  if (!dono?.telegram_chat_id) return responder(200, { avisado: false, motivo: 'sem_telegram' })
  if (!telegramConfigurado()) return responder(503, { erro: 'Telegram não configurado' })

  // Reserva o aviso antes de enviar: duas chamadas ao mesmo tempo não avisam duas vezes
  const { data: reservado } = await supabase
    .from('chamados')
    .update({ produtor_avisado_em: new Date().toISOString() })
    .eq('id', chamado.id)
    .is('produtor_avisado_em', null)
    .select('id')
  if (!reservado?.length) return responder(200, { avisado: false, motivo: 'ja_avisado' })

  const { data: validacao } = await supabase
    .from('validacoes')
    .select('praga_nome_comum, praga_nome_cientifico')
    .eq('chamado_id', chamado.id)
    .maybeSingle()

  const texto = mensagemAoProdutor({
    status: chamado.status,
    cultura: chamado.cultura,
    enviadoEm: chamado.criado_em,
    pragaComum: validacao?.praga_nome_comum ?? null,
    pragaCientifica: validacao?.praga_nome_cientifico ?? null,
    urlApp: URL_APP,
  })
  const envio = await telegram('sendMessage', {
    chat_id: dono.telegram_chat_id,
    text: texto,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  })

  if (!envio.ok) {
    // Libera para tentar de novo (ex.: produtor bloqueou o bot)
    await supabase.from('chamados').update({ produtor_avisado_em: null }).eq('id', chamado.id)
    log('falhou', { chamado_id: chamado.id, status: chamado.status, motivo: envio.description ?? 'desconhecido' })
    return responder(200, { avisado: false, motivo: 'telegram_falhou' })
  }

  log('avisado', { chamado_id: chamado.id, status: chamado.status })
  return responder(200, { avisado: true })
})
