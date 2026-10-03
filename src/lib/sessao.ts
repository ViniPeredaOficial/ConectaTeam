import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Acesso = 'carregando' | 'deslogado' | 'negado' | 'ok'
export type PapelEquipe = 'especialista' | 'administrador'

// Confere se há sessão e se o perfil tem o papel pedido (especialista ou administrador)
export async function verificarPapel(papel: PapelEquipe): Promise<Exclude<Acesso, 'carregando'>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || session.user.is_anonymous) return 'deslogado'

  const { data } = await supabase.from('perfis').select('papel').eq('id', session.user.id).maybeSingle()
  return data?.papel === papel ? 'ok' : 'negado'
}

export const verificarEspecialista = () => verificarPapel('especialista')

// Estado de acesso de uma área da equipe, atualizado quando a sessão muda (login/logout)
export function usePapel(papel: PapelEquipe): Acesso {
  const [acesso, setAcesso] = useState<Acesso>('carregando')

  useEffect(() => {
    const atualizar = () => {
      verificarPapel(papel).then(setAcesso)
    }
    atualizar()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(atualizar, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [papel])

  return acesso
}

export const useEspecialista = () => usePapel('especialista')

// Sessão com o papel da conta (perfis.papel). Sessão anônima antiga conta como deslogado.
// Uma conta tem um papel só: cada área aceita apenas o seu.
export type Sessao =
  | { estado: 'carregando' }
  | { estado: 'deslogado' }
  | { estado: 'produtor' | PapelEquipe; nome: string | null }

async function lerSessao(): Promise<Sessao> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || session.user.is_anonymous) return { estado: 'deslogado' }

  const { data: perfil } = await supabase.from('perfis').select('papel, nome').eq('id', session.user.id).maybeSingle()
  const nomeCadastro = session.user.user_metadata?.nome
  const nome = [perfil?.nome, nomeCadastro].find((n) => typeof n === 'string' && n.trim())?.trim() ?? null
  const papel = perfil?.papel === 'especialista' || perfil?.papel === 'administrador' ? perfil.papel : 'produtor'
  return { estado: papel, nome }
}

export function useSessao(): Sessao {
  const [sessao, setSessao] = useState<Sessao>({ estado: 'carregando' })

  useEffect(() => {
    const atualizar = () => {
      lerSessao().then(setSessao)
    }
    atualizar()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // setTimeout: o Supabase recomenda não chamar o próprio cliente dentro deste callback
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') setTimeout(atualizar, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return sessao
}

// Página inicial de cada papel da equipe
export const PAINEL_DO_PAPEL: Record<PapelEquipe, string> = {
  especialista: '/especialista',
  administrador: '/admin',
}

export async function sair() {
  await supabase.auth.signOut()
}
