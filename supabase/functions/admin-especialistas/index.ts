// Edge Function "admin-especialistas": o administrador cadastra, bloqueia e reativa especialistas.
// Criar usuário exige a service_role, por isso fica no servidor (nunca no navegador).
// Entrada: POST { acao: 'criar', nome, email, senha } | { acao: 'bloquear' | 'reativar', id }

import { createClient } from '@supabase/supabase-js'
import { cabecalhosCors } from '../_shared/cors.ts'

const SENHA_MINIMA = 8
const DOMINIO_INTERNO_PRODUTOR = '@celular.radardepragas.app' // e-mails internos do login por celular
const BLOQUEIO = '876000h' // ~100 anos: bloqueado até alguém reativar

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

// Log sem dados pessoais (nada de e-mail ou nome)
function log(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ funcao: 'admin-especialistas', evento, ...dados }))
}

Deno.serve(async (req) => {
  const cors = cabecalhosCors(req)
  const responder = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder(405, { erro: 'Método não permitido' })

  // Só administrador
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder(401, { erro: 'Sem token' })
  const { data: auth } = await supabase.auth.getUser(token)
  if (!auth?.user) return responder(401, { erro: 'Token inválido' })
  const { data: quem } = await supabase.from('perfis').select('papel').eq('id', auth.user.id).maybeSingle()
  if (quem?.papel !== 'administrador') return responder(403, { erro: 'Acesso restrito a administradores' })

  let corpo: { acao?: string; nome?: string; email?: string; senha?: string; id?: string } = {}
  try {
    corpo = await req.json()
  } catch {
    // tratado abaixo
  }

  if (corpo.acao === 'criar') {
    const nome = (corpo.nome ?? '').trim().slice(0, 80)
    const email = (corpo.email ?? '').trim().toLowerCase()
    const senha = corpo.senha ?? ''
    if (!nome) return responder(422, { erro: 'Informe o nome do especialista.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(DOMINIO_INTERNO_PRODUTOR)) {
      return responder(422, { erro: 'Informe um e-mail válido.' })
    }
    if (senha.length < SENHA_MINIMA) {
      return responder(422, { erro: `A senha inicial precisa ter pelo menos ${SENHA_MINIMA} caracteres.` })
    }

    // Conta já confirmada (sem e-mail de confirmação: o envio grátis é limitado)
    const { data: criado, error } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    })
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message)
      log('criar_falhou', { motivo: jaExiste ? 'email_existente' : error.message })
      return responder(jaExiste ? 409 : 500, {
        erro: jaExiste ? 'Já existe uma conta com este e-mail.' : 'Não foi possível criar a conta.',
      })
    }

    // O gatilho do banco cria o perfil como produtor; aqui vira especialista
    const { error: erroPerfil } = await supabase
      .from('perfis')
      .update({ papel: 'especialista', nome })
      .eq('id', criado.user.id)
    if (erroPerfil) {
      await supabase.auth.admin.deleteUser(criado.user.id) // não deixa conta pela metade
      log('criar_falhou', { motivo: 'perfil' })
      return responder(500, { erro: 'Não foi possível concluir o cadastro.' })
    }

    log('criado', { especialista: criado.user.id })
    return responder(200, { id: criado.user.id })
  }

  if (corpo.acao === 'bloquear' || corpo.acao === 'reativar') {
    if (!corpo.id) return responder(400, { erro: 'Informe o especialista.' })
    // Só mexe em contas de especialista (nunca em produtor ou administrador)
    const { data: alvo } = await supabase.from('perfis').select('papel').eq('id', corpo.id).maybeSingle()
    if (alvo?.papel !== 'especialista') return responder(404, { erro: 'Especialista não encontrado.' })

    const { error } = await supabase.auth.admin.updateUserById(corpo.id, {
      ban_duration: corpo.acao === 'bloquear' ? BLOQUEIO : 'none',
    })
    if (error) {
      log(`${corpo.acao}_falhou`, { motivo: error.message })
      return responder(500, { erro: 'Não foi possível alterar o acesso.' })
    }
    log(corpo.acao, { especialista: corpo.id })
    return responder(200, { ok: true })
  }

  return responder(400, { erro: 'Ação inválida.' })
})
