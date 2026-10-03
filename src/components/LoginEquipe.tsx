import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { PAINEL_DO_PAPEL, sair, verificarPapel } from '../lib/sessao'
import type { PapelEquipe } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { useTitulo } from '../lib/titulo'

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
  const [mostrarSenha, setMostrarSenha] = useState(false)
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
    <div className="mx-auto flex max-w-md flex-col gap-4 py-4 sm:py-8">
      <section className="rounded-2xl border border-folha-200 bg-white p-5 shadow-sm sm:p-7">
        <h1 className="text-2xl font-bold text-folha-900">{titulo}</h1>
        <p className="mt-2 text-sm text-gray-600">Entre com o e-mail e a senha da sua conta.</p>
        <form onSubmit={entrar} className="mt-6 flex flex-col gap-5">
          <label className="block">
            <span className="text-sm font-semibold text-gray-800">E-mail</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-folha-300 bg-white px-3 text-base text-gray-900 focus:border-folha-600 focus:outline-2 focus:outline-offset-1 focus:outline-folha-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-gray-800">Senha</span>
            <span className="relative mt-1 block">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-folha-300 bg-white px-3 pr-12 text-base text-gray-900 focus:border-folha-600 focus:outline-2 focus:outline-offset-1 focus:outline-folha-500"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((visivel) => !visivel)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-folha-700 hover:bg-folha-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-folha-600"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  {mostrarSenha ? (
                    <>
                      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  ) : (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.2 3.1M6.2 6.2C3.9 7.6 2.7 9.5 2.5 12c.5 1.2 1.4 2.5 2.7 3.6A10.2 10.2 0 0012 19c1 0 1.9-.2 2.8-.5" />
                    </>
                  )}
                </svg>
              </button>
            </span>
          </label>
          {erro && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={entrando}
            className="min-h-12 rounded-xl bg-folha-700 px-5 font-semibold text-white hover:bg-folha-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-folha-500 disabled:opacity-50"
          >
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  )
}
