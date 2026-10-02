import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Acesso = 'carregando' | 'deslogado' | 'negado' | 'ok'

// Confere se há sessão e se o perfil é de especialista
export async function verificarEspecialista(): Promise<Exclude<Acesso, 'carregando'>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || session.user.is_anonymous) return 'deslogado'

  const { data } = await supabase.from('perfis').select('papel').eq('id', session.user.id).maybeSingle()
  return data?.papel === 'especialista' ? 'ok' : 'negado'
}

// Estado de acesso do especialista, atualizado quando a sessão muda (login/logout)
export function useEspecialista(): Acesso {
  const [acesso, setAcesso] = useState<Acesso>('carregando')

  useEffect(() => {
    const atualizar = () => {
      verificarEspecialista().then(setAcesso)
    }
    atualizar()
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(atualizar, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return acesso
}

// Sessão com o papel da conta (perfis.papel). Sessão anônima antiga conta como deslogado.
// Uma conta é produtor OU especialista: cada área só aceita o seu papel.
export type Sessao =
  | { estado: 'carregando' }
  | { estado: 'deslogado' }
  | { estado: 'produtor' | 'especialista'; nome: string | null }

async function lerSessao(): Promise<Sessao> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session || session.user.is_anonymous) return { estado: 'deslogado' }

  const { data: perfil } = await supabase.from('perfis').select('papel, nome').eq('id', session.user.id).maybeSingle()
  const nomeCadastro = session.user.user_metadata?.nome
  const nome = [perfil?.nome, nomeCadastro].find((n) => typeof n === 'string' && n.trim())?.trim() ?? null
  return { estado: perfil?.papel === 'especialista' ? 'especialista' : 'produtor', nome }
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

export async function sair() {
  await supabase.auth.signOut()
}
