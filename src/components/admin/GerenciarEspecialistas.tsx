import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type Especialista = { id: string; nome: string | null; email: string; criado_em: string; bloqueado: boolean; analises: number }

const SENHA_MINIMA = 8
const campo = 'w-full rounded-lg border-2 border-gray-200 px-3 py-2 focus:border-folha-500 focus:outline-none'

// Senha inicial aleatória, sem caracteres que se confundem (0/O, 1/l)
function gerarSenha(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => letras[b % letras.length]).join('')
}

// Chama a Edge Function admin-especialistas e devolve a mensagem de erro, se houver
async function chamarFuncao(corpo: Record<string, string>): Promise<string | null> {
  const { error } = await supabase.functions.invoke('admin-especialistas', { body: corpo })
  if (!error) return null
  if (!(error instanceof FunctionsHttpError)) return 'Sem conexão. Tente de novo.'
  if (error.context.status === 404) return 'A função de cadastro ainda não foi publicada no servidor.'
  const detalhe = ((await error.context.json().catch(() => null)) as { erro?: string } | null)?.erro
  return detalhe ?? 'Não foi possível concluir.'
}

// Aba "Especialistas" do painel: lista, cadastro, bloquear e reativar
export default function GerenciarEspecialistas() {
  const [lista, setLista] = useState<Especialista[] | null>(null)
  const [erroLista, setErroLista] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const carregar = useCallback(() => {
    supabase.rpc('listar_especialistas').then(({ data, error }) => {
      if (error) return setErroLista(true)
      setLista(data as Especialista[])
      setErroLista(false)
    })
  }, [])

  useEffect(carregar, [carregar])

  async function cadastrar(e: FormEvent) {
    e.preventDefault()
    setMensagem(null)
    if (senha.length < SENHA_MINIMA) {
      return setMensagem({ tipo: 'erro', texto: `A senha inicial precisa ter pelo menos ${SENHA_MINIMA} caracteres.` })
    }
    setEnviando(true)
    const erro = await chamarFuncao({ acao: 'criar', nome: nome.trim(), email: email.trim(), senha })
    setEnviando(false)
    if (erro) return setMensagem({ tipo: 'erro', texto: erro })
    setMensagem({
      tipo: 'ok',
      texto: `Conta criada para ${nome.trim()}. Passe o e-mail e a senha inicial pessoalmente: ${senha}`,
    })
    setNome('')
    setEmail('')
    setSenha('')
    carregar()
  }

  async function alterarAcesso(esp: Especialista) {
    const acao = esp.bloqueado ? 'reativar' : 'bloquear'
    const pergunta = esp.bloqueado
      ? `Reativar o acesso de ${esp.nome ?? esp.email}?`
      : `Bloquear o acesso de ${esp.nome ?? esp.email}? A pessoa não conseguirá mais entrar no painel.`
    if (!window.confirm(pergunta)) return
    const erro = await chamarFuncao({ acao, id: esp.id })
    if (erro) setMensagem({ tipo: 'erro', texto: erro })
    carregar()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      {/* Lista */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-folha-800">Especialistas cadastrados</h2>
        {erroLista && <p className="text-red-700">Não conseguimos carregar a lista.</p>}
        {lista && lista.length === 0 && <p className="text-gray-600">Nenhum especialista ainda.</p>}
        {lista && lista.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="py-2">Nome</th>
                <th className="py-2">E-mail</th>
                <th className="py-2">Desde</th>
                <th className="py-2">Análises</th>
                <th className="py-2">Situação</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((esp) => (
                <tr key={esp.id} className="border-t border-gray-100">
                  <td className="py-2 font-semibold text-gray-900">{esp.nome ?? '(sem nome)'}</td>
                  <td className="py-2 text-gray-700">{esp.email}</td>
                  <td className="py-2 text-gray-700">{new Date(esp.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td className="py-2 text-gray-700">{esp.analises}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        esp.bloqueado ? 'bg-red-100 text-red-800' : 'bg-folha-100 text-folha-800'
                      }`}
                    >
                      {esp.bloqueado ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => alterarAcesso(esp)} className="text-sm font-semibold text-folha-700 underline">
                      {esp.bloqueado ? 'Reativar' : 'Bloquear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Cadastro */}
      <form onSubmit={cadastrar} className="flex flex-col gap-3 self-start rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-folha-800">Cadastrar especialista</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-gray-700">Nome</span>
          <input required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-gray-700">E-mail</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-gray-700">Senha inicial</span>
          <div className="flex gap-2">
            <input required minLength={SENHA_MINIMA} value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
            <button
              type="button"
              onClick={() => setSenha(gerarSenha())}
              className="shrink-0 rounded-lg border-2 border-folha-600 px-3 font-semibold text-folha-700 hover:bg-folha-50"
            >
              Gerar
            </button>
          </div>
          <span className="text-gray-500">Pelo menos {SENHA_MINIMA} caracteres. Passe pessoalmente ao especialista.</span>
        </label>
        {mensagem && (
          <p
            role="status"
            className={`rounded-lg p-2 text-sm ${mensagem.tipo === 'ok' ? 'bg-folha-100 text-folha-900' : 'bg-red-50 text-red-800'}`}
          >
            {mensagem.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="min-h-12 rounded-xl bg-folha-600 font-semibold text-white hover:bg-folha-700 disabled:opacity-50"
        >
          {enviando ? 'Cadastrando...' : 'Cadastrar especialista'}
        </button>
      </form>
    </div>
  )
}
