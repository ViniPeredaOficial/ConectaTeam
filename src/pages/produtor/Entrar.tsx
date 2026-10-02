import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import BotaoGrande from '../../components/BotaoGrande'
import { emailDoCelular, mascararCelular, normalizarCelular } from '../../lib/celular'
import { supabase } from '../../lib/supabase'

type Aba = 'entrar' | 'criar'

const SENHA_MINIMA = 6
const campo =
  'mt-1 min-h-12 w-full rounded-xl border-2 border-gray-200 px-3 text-lg focus:border-folha-500 focus:outline-none'

// Traduz os erros do Supabase Auth para linguagem simples
function mensagemDeErro(mensagem: string): string {
  if (/already registered|already exists/i.test(mensagem)) return 'Este celular já tem conta. Toque em "Entrar".'
  if (/invalid login credentials/i.test(mensagem)) return 'Celular ou senha incorretos.'
  if (/password/i.test(mensagem)) return `A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`
  return 'Não conseguimos completar agora. Confira a internet e tente de novo.'
}

// Login e cadastro do produtor por celular + senha
export default function Entrar() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const voltar = parametros.get('voltar')?.startsWith('/produtor') ? parametros.get('voltar')! : '/produtor'

  const [aba, setAba] = useState<Aba>(parametros.get('aba') === 'criar' ? 'criar' : 'entrar')
  const [celular, setCelular] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarAjudaSenha, setMostrarAjudaSenha] = useState(false)

  function trocarAba(nova: Aba) {
    setAba(nova)
    setErro(null)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    const numero = normalizarCelular(celular)
    if (!numero) return setErro('Confira o celular: DDD + número, ex.: (16) 99999-8888.')
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`)
    if (aba === 'criar') {
      if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')
      if (!aceite) return setErro('Para criar a conta, marque que você concorda com o uso do celular.')
    }

    setEnviando(true)
    // Sessão anônima antiga (versão sem login) é descartada antes de entrar
    const {
      data: { session: atual },
    } = await supabase.auth.getSession()
    if (atual?.user.is_anonymous) await supabase.auth.signOut()

    const email = emailDoCelular(numero)
    const { data, error } =
      aba === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({
            email,
            password: senha,
            options: { data: nome.trim() ? { nome: nome.trim().slice(0, 80) } : {} },
          })
    setEnviando(false)

    if (error) return setErro(mensagemDeErro(error.message))
    // Sem sessão no cadastro = "Confirm email" ainda ligado no Supabase
    if (!data.session) return setErro('O cadastro está em manutenção. Avise a equipe do Radar de Pragas.')
    navegar(voltar, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold text-folha-800">
        {aba === 'entrar' ? 'Entrar' : 'Criar conta'}
      </h1>
      <p className="text-gray-700">Com a conta, você acompanha seus chamados em qualquer celular.</p>

      {/* Abas */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist">
        {(
          [
            ['entrar', 'Já tenho conta'],
            ['criar', 'Criar conta'],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={aba === valor}
            onClick={() => trocarAba(valor)}
            className={`min-h-12 rounded-lg text-lg font-semibold ${
              aba === valor ? 'bg-folha-600 text-white' : 'text-folha-800'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-base font-semibold text-gray-800">Celular (com DDD)</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(16) 99999-8888"
            value={celular}
            onChange={(e) => setCelular(mascararCelular(e.target.value))}
            className={campo}
          />
        </label>

        {aba === 'criar' && (
          <label className="block">
            <span className="text-base font-semibold text-gray-800">Como podemos te chamar? (opcional)</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              autoComplete="given-name"
              className={campo}
            />
          </label>
        )}

        <label className="block">
          <span className="text-base font-semibold text-gray-800">Senha</span>
          <input
            type="password"
            autoComplete={aba === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
          />
          {aba === 'criar' && (
            <span className="text-sm text-gray-600">Pelo menos {SENHA_MINIMA} letras ou números.</span>
          )}
        </label>

        {aba === 'criar' && (
          <>
            <label className="block">
              <span className="text-base font-semibold text-gray-800">Repita a senha</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className={campo}
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-folha-50 p-3">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-folha-600"
              />
              <span className="text-sm text-gray-800">
                Uso meu celular só para entrar no Radar de Pragas. Ele não aparece para o especialista nem nos alertas.
              </span>
            </label>
          </>
        )}

        {erro && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
            {erro}
          </p>
        )}

        <BotaoGrande type="submit" disabled={enviando}>
          {enviando ? 'Aguarde...' : aba === 'entrar' ? 'Entrar' : 'Criar conta e continuar'}
        </BotaoGrande>

        {aba === 'entrar' && (
          <button
            type="button"
            onClick={() => setMostrarAjudaSenha((v) => !v)}
            className="text-sm font-semibold text-folha-700 underline"
          >
            Esqueci minha senha
          </button>
        )}
        {aba === 'entrar' && mostrarAjudaSenha && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            A recuperação de senha por SMS será desenvolvida futuramente. Nesta versão de demonstração (MVP), ela ainda
            não está funcionando.
          </p>
        )}
      </form>
    </div>
  )
}
