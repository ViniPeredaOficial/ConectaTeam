import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PAINEL_DO_PAPEL, sair, verificarPapel } from '../lib/sessao'
import type { PapelEquipe } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { useTitulo } from '../lib/titulo'
import BotaoVoltar from './BotaoVoltar'

const TEXTOS: Record<PapelEquipe, { titulo: string; restrito: string }> = {
  especialista: { titulo: 'Acesso do especialista', restrito: 'Acesso restrito a especialistas' },
  administrador: { titulo: 'Acesso da administração', restrito: 'Acesso restrito a administradores' },
}

// Login da equipe (e-mail e senha do Supabase Auth): só entra quem tem o papel da área
export default function LoginEquipe({ papel }: { papel: PapelEquipe }) {
  const { titulo, restrito } = TEXTOS[papel]
  const destino = PAINEL_DO_PAPEL[papel]
  useTitulo(titulo)
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Já logado com este papel: vai direto para o painel
  useEffect(() => {
    verificarPapel(papel).then((acesso) => {
      if (acesso === 'ok') navegar(destino, { replace: true })
    })
  }, [navegar, papel, destino])

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEntrando(true)
    setErro(null)

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    if (error) {
      setErro(/banned/i.test(error.message) ? 'Este acesso foi bloqueado pela administração.' : 'E-mail ou senha incorretos.')
      setEntrando(false)
      return
    }

    if ((await verificarPapel(papel)) !== 'ok') {
      await sair()
      setErro(restrito)
      setEntrando(false)
      return
    }
    navegar(destino, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3">
      <BotaoVoltar para="/" rotulo="Voltar para o início" />
      <form onSubmit={entrar} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold text-folha-800">{titulo}</h1>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-700">E-mail</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-folha-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-700">Senha</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-folha-500 focus:outline-none"
          />
        </label>
        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 p-2 text-red-800">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={entrando}
          className="min-h-12 rounded-xl bg-folha-600 font-semibold text-white hover:bg-folha-700 disabled:opacity-50"
        >
          {entrando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
