import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import BotaoGrande from '../../components/BotaoGrande'
import BotaoVoltar from '../../components/BotaoVoltar'
import ContaDaEquipe from '../../components/ContaDaEquipe'
import { emailDoCelular, mascararCelular, normalizarCelular } from '../../lib/celular'
import { useSessao } from '../../lib/sessao'
import { supabase } from '../../lib/supabase'
import { useTitulo } from '../../lib/titulo'

type Aba = 'entrar' | 'criar'
type EtapaCadastro = 'dados' | 'senha' | 'privacidade'

const SENHA_MINIMA = 6
const campo =
  'mt-1 min-h-11 w-full rounded-xl border border-folha-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-folha-600 focus:outline-2 focus:outline-offset-1 focus:outline-folha-500'
const campoSenha =
  'min-h-11 w-full rounded-xl border border-folha-300 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-folha-600 focus:outline-2 focus:outline-offset-1 focus:outline-folha-500'

function BotaoVisibilidadeSenha({ visivel, aoAlternar, rotulo }: { visivel: boolean; aoAlternar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-label={rotulo}
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-folha-700 hover:bg-folha-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-folha-600"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        {visivel ? (
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
  )
}

// Traduz os erros do Supabase Auth para linguagem simples
function mensagemDeErro(mensagem: string): string {
  if (/already registered|already exists/i.test(mensagem)) return 'Este celular já tem conta. Toque em "Entrar".'
  if (/invalid login credentials/i.test(mensagem)) return 'Celular ou senha incorretos.'
  if (/password/i.test(mensagem)) return `A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`
  return 'Não conseguimos completar agora. Confira a internet e tente de novo.'
}

// Login e cadastro do produtor por celular + senha
export default function Entrar() {
  useTitulo('Entrar')
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const voltar = parametros.get('voltar')?.startsWith('/produtor') ? parametros.get('voltar')! : '/produtor'

  const [aba, setAba] = useState<Aba>(parametros.get('aba') === 'criar' ? 'criar' : 'entrar')
  const [etapaCadastro, setEtapaCadastro] = useState<EtapaCadastro>('dados')
  const [celular, setCelular] = useState('')
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false)
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarAjudaSenha, setMostrarAjudaSenha] = useState(false)
  const sessao = useSessao()

  function trocarAba(nova: Aba) {
    setAba(nova)
    setEtapaCadastro('dados')
    setAceite(false)
    setErro(null)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    const numero = normalizarCelular(celular)
    if (!numero) return setErro('Confira o celular: DDD + número, ex.: (16) 99999-8888.')
    if (aba === 'criar' && etapaCadastro === 'dados') {
      setEtapaCadastro('senha')
      return
    }
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} letras ou números.`)
    if (aba === 'criar') {
      if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')
      if (etapaCadastro === 'senha') {
        setEtapaCadastro('privacidade')
        return
      }
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

  // Já entrou como produtor: segue para onde ia
  if (sessao.estado === 'produtor') return <Navigate to={voltar} replace />
  // Conta da equipe não entra na área do produtor
  if (sessao.estado === 'especialista' || sessao.estado === 'administrador') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <BotaoVoltar para="/" rotulo="Voltar para o início" />
        <ContaDaEquipe papel={sessao.estado} rotuloSair="Sair para entrar como produtor" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 sm:gap-4 sm:py-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-folha-100 p-1" role="tablist" aria-label="Acesso à conta">
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
            className={`min-h-11 rounded-lg px-2 text-sm font-semibold transition-colors ${
              aba === valor ? 'bg-folha-700 text-white shadow-sm' : 'text-folha-800 hover:bg-white'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-folha-200 bg-white p-4 shadow-sm sm:p-7">
        <h1 className="text-2xl font-bold text-folha-900">{aba === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          Com a conta, você acompanha seus chamados em qualquer celular.
        </p>

        <form onSubmit={enviar} className="mt-4 flex flex-col gap-4">
          {aba === 'entrar' || etapaCadastro === 'dados' ? (
            <>
              {aba === 'criar' && (
                <p className="text-xs font-semibold uppercase tracking-wide text-folha-700">Etapa 1 de 3 · Seus dados</p>
              )}
              <label className="block">
                <span className="text-sm font-semibold text-gray-800">Celular</span>
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
              {aba === 'criar' ? (
                <label className="block">
                  <span className="text-sm font-semibold text-gray-800">Nome (opcional)</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    maxLength={80}
                    autoComplete="given-name"
                    className={campo}
                  />
                </label>
              ) : (
                <div>
                  <label htmlFor="senha-entrar" className="text-sm font-semibold text-gray-800">Senha</label>
                  <div className="relative mt-1">
                    <input
                      id="senha-entrar"
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className={`${campoSenha} pr-12`}
                    />
                    <BotaoVisibilidadeSenha
                      visivel={mostrarSenha}
                      aoAlternar={() => setMostrarSenha((visivel) => !visivel)}
                      rotulo={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    />
                  </div>
                </div>
              )}
            </>
          ) : etapaCadastro === 'senha' ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-folha-700">Etapa 2 de 3 · Proteja sua conta</p>
              <div>
                <label htmlFor="senha-cadastro" className="text-sm font-semibold text-gray-800">Senha</label>
                <div className="relative mt-1">
                  <input
                    id="senha-cadastro"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={`${campoSenha} pr-12`}
                  />
                  <BotaoVisibilidadeSenha
                    visivel={mostrarSenha}
                    aoAlternar={() => setMostrarSenha((visivel) => !visivel)}
                    rotulo={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  />
                </div>
                <span className="mt-1 block text-xs text-gray-600">Pelo menos {SENHA_MINIMA} letras ou números.</span>
              </div>
              <div>
                <label htmlFor="confirmacao-senha" className="text-sm font-semibold text-gray-800">Repita a senha</label>
                <div className="relative mt-1">
                  <input
                    id="confirmacao-senha"
                    type={mostrarConfirmacao ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    className={`${campoSenha} pr-12`}
                  />
                  <BotaoVisibilidadeSenha
                    visivel={mostrarConfirmacao}
                    aoAlternar={() => setMostrarConfirmacao((visivel) => !visivel)}
                    rotulo={mostrarConfirmacao ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-folha-700">Etapa 3 de 3 · Privacidade</p>
              <p className="text-sm leading-relaxed text-gray-700">
                Seu celular é usado apenas para acessar sua conta. Ele não aparece para o especialista nem nos alertas.
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-folha-100 bg-folha-50 p-3">
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-folha-600"
                />
                <span className="text-sm leading-6 text-gray-700">
                  Concordo que meu número de celular seja usado para acessar minha conta.
                </span>
              </label>
            </>
          )}

          {erro && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-snug text-red-800">
              {erro}
            </p>
          )}

          <BotaoGrande type="submit" disabled={enviando}>
            {enviando
              ? 'Aguarde...'
              : aba === 'entrar'
                ? 'Entrar'
                : etapaCadastro === 'dados'
                  ? 'Prosseguir'
                  : etapaCadastro === 'senha'
                    ? 'Prosseguir'
                    : 'Criar conta e continuar'}
          </BotaoGrande>

          {aba === 'entrar' && (
            <button
              type="button"
              onClick={() => setMostrarAjudaSenha((v) => !v)}
              className="self-center text-sm font-semibold text-folha-700 underline underline-offset-2"
            >
              Esqueci minha senha
            </button>
          )}
          {aba === 'criar' && etapaCadastro !== 'dados' && (
            <button
              type="button"
              onClick={() => {
                setEtapaCadastro(etapaCadastro === 'privacidade' ? 'senha' : 'dados')
                setErro(null)
              }}
              className="self-center text-sm font-semibold text-folha-700 underline underline-offset-2"
            >
              {etapaCadastro === 'privacidade' ? 'Voltar para a senha' : 'Voltar para os dados'}
            </button>
          )}
          {aba === 'entrar' && mostrarAjudaSenha && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              A recuperação de senha por SMS será desenvolvida futuramente. Nesta versão de demonstração (MVP), ela ainda
              não está funcionando.
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
