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
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') atualizar()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return acesso
}

export async function sair() {
  await supabase.auth.signOut()
}
