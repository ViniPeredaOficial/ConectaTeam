import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import BotaoDitado from '../../components/BotaoDitado'
import BotaoGrande from '../../components/BotaoGrande'
import Passo from '../../components/Passo'
import { buscarCulturas, iconeDaCultura } from '../../lib/culturas'
import { DISTANCIA_MAXIMA_KM, municipioMaisProximo, pegarLocalizacao } from '../../lib/geo'
import { recomprimirFoto } from '../../lib/imagem'
import { supabase } from '../../lib/supabase'
import type { Municipio } from '../../types/database'

const MAX_DESCRICAO = 500

type EstadoLocal = 'inicial' | 'buscando' | 'achou' | 'manual'
type EstadoEnvio = 'parado' | 'enviando' | 'erro' | 'sucesso'

// Etapas já concluídas: o "tentar de novo" continua daqui, sem duplicar foto ou chamado
type Progresso = { fotoPath?: string; chamadoId?: string; localizacaoGravada?: boolean }

// Formulário de novo chamado do produtor, em 4 passos
export default function NovoChamado() {
  // Dados de apoio
  const [culturas, setCulturas] = useState<string[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [erroCarregar, setErroCarregar] = useState(false)

  // Campos do formulário
  const [foto, setFoto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [cultura, setCultura] = useState('')
  const [descricao, setDescricao] = useState('')
  const [municipioCod, setMunicipioCod] = useState<number | null>(null)

  // Coordenada exata: fica só em memória para gravar em chamados_localizacao. Nunca é exibida.
  const coordenada = useRef<{ lat: number; lon: number } | null>(null)
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocal>('inicial')
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null)

  // Envio
  const [envio, setEnvio] = useState<EstadoEnvio>('parado')
  const [etapa, setEtapa] = useState('')
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const progresso = useRef<Progresso>({})

  // Carrega culturas do Agrofit e municípios de SP (o estado só muda quando a resposta chega)
  function carregar() {
    buscarListas()
      .then(([listaCulturas, listaMunicipios]) => {
        setCulturas(listaCulturas)
        setMunicipios(listaMunicipios)
        setErroCarregar(false)
      })
      .catch((e) => {
        console.error('Falha ao carregar dados', e)
        setErroCarregar(true)
      })
  }

  useEffect(carregar, [])

  // Troca a prévia, liberando a memória da anterior
  function trocarPrevia(arquivo: File | null) {
    if (previa) URL.revokeObjectURL(previa)
    setPrevia(arquivo ? URL.createObjectURL(arquivo) : null)
  }

  function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    setFoto(arquivo)
    trocarPrevia(arquivo)
    progresso.current = {} // foto nova: precisa subir de novo
  }

  async function usarMinhaLocalizacao() {
    setEstadoLocal('buscando')
    setAvisoLocal(null)
    try {
      const posicao = await pegarLocalizacao()
      const { latitude, longitude } = posicao.coords
      const perto = municipioMaisProximo(latitude, longitude, municipios)
      if (!perto || perto.distancia > DISTANCIA_MAXIMA_KM) {
        coordenada.current = null
        setEstadoLocal('manual')
        setAvisoLocal('Não achamos um município de SP perto de você. Escolha na lista.')
        return
      }
      coordenada.current = { lat: latitude, lon: longitude }
      setMunicipioCod(perto.municipio.cod_ibge)
      setEstadoLocal('achou')
    } catch (e) {
      const negou = (e as GeolocationPositionError)?.code === 1
      setEstadoLocal('manual')
      setAvisoLocal(
        negou
          ? 'Sem permissão de localização. Tudo bem: escolha seu município na lista.'
          : 'Não conseguimos achar sua localização. Escolha seu município na lista.',
      )
    }
  }

  function escolherMunicipioNaLista(cod: string) {
    // Escolha manual: descarta a coordenada do GPS para não gravar um ponto que não bate
    coordenada.current = null
    setMunicipioCod(cod ? Number(cod) : null)
  }

  const nomeMunicipio = municipios.find((m) => m.cod_ibge === municipioCod)?.nome
  const podeEnviar = Boolean(foto && cultura && municipioCod) && envio !== 'enviando'

  async function enviar() {
    if (!foto || !cultura || !municipioCod) return
    setEnvio('enviando')
    setErroEnvio(null)

    try {
      // 1. Sessão da conta do produtor (a rota já exige login com celular + senha)
      setEtapa('Conectando...')
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('sem_sessao')
      const uid = session.user.id

      // 2. Foto recomprimida (sem EXIF/GPS) em fotos/{uid}/{uuid}.jpg
      if (!progresso.current.fotoPath) {
        setEtapa('Preparando a foto...')
        const jpeg = await recomprimirFoto(foto)
        setEtapa('Enviando a foto...')
        const caminho = `${uid}/${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage
          .from('fotos')
          .upload(caminho, jpeg, { contentType: 'image/jpeg' })
        if (error) throw error
        progresso.current.fotoPath = caminho
      }

      // 3. Chamado (sem coordenada)
      if (!progresso.current.chamadoId) {
        setEtapa('Registrando o chamado...')
        const { data, error } = await supabase
          .from('chamados')
          .insert({
            cultura,
            descricao: descricao.trim() || null,
            foto_path: progresso.current.fotoPath,
            municipio_cod: municipioCod,
          })
          .select('id')
          .single()
        if (error) throw error
        progresso.current.chamadoId = data.id
      }
      const chamadoId = progresso.current.chamadoId!

      // 4. Coordenada exata em tabela separada (só quando veio do GPS)
      if (coordenada.current && !progresso.current.localizacaoGravada) {
        const { error } = await supabase
          .from('chamados_localizacao')
          .insert({ chamado_id: chamadoId, ...coordenada.current })
        if (error) throw error
        progresso.current.localizacaoGravada = true
      }

      // 5. Triagem pela IA em segundo plano: não esperamos a resposta
      supabase.functions.invoke('triagem', { body: { chamado_id: chamadoId } }).then(({ error }) => {
        if (error) console.warn('Triagem não iniciada; o especialista segue sem a IA.')
      })

      progresso.current = {}
      setEnvio('sucesso')
    } catch (e) {
      console.error('Falha no envio', e)
      const mensagem = e instanceof Error && e.message.startsWith('Não foi possível') ? e.message : null
      setErroEnvio(mensagem ?? 'Não conseguimos enviar. Confira a internet e toque em "Tentar de novo".')
      setEnvio('erro')
    }
  }

  function novoChamado() {
    setFoto(null)
    trocarPrevia(null)
    setCultura('')
    setDescricao('')
    setMunicipioCod(null)
    setEstadoLocal('inicial')
    setAvisoLocal(null)
    coordenada.current = null
    setEnvio('parado')
  }

  // Tela de sucesso
  if (envio === 'sucesso') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6 text-center">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-folha-800">Recebemos!</h1>
        <p className="text-lg text-gray-700">Um especialista vai analisar. Você será avisado aqui.</p>
        <BotaoGrande to="/produtor/chamados">Ver meus chamados</BotaoGrande>
        <BotaoGrande variante="secundario" onClick={novoChamado}>
          Enviar outro problema
        </BotaoGrande>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-folha-800">Reportar praga</h1>
        <Link to="/produtor/chamados" className="text-sm font-semibold text-folha-700 underline">
          Meus chamados
        </Link>
      </div>

      {erroCarregar && (
        <div className="rounded-xl bg-red-50 p-3 text-red-800">
          Não conseguimos carregar as listas.{' '}
          <button className="font-semibold underline" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* 1. Foto */}
      <Passo numero={1} titulo="Tire uma foto do problema" feito={Boolean(foto)}>
        {previa && (
          <img src={previa} alt="Prévia da foto" className="mb-3 max-h-72 w-full rounded-xl object-cover" />
        )}
        <label className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-folha-500 bg-folha-50 px-4 py-3 text-lg font-semibold text-folha-700">
          📷 {foto ? 'Trocar foto' : 'Tirar foto'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />
        </label>
        <p className="mt-2 text-sm text-gray-600">Chegue perto da folha ou do fruto, com luz do dia.</p>
      </Passo>

      {/* 2. Cultura */}
      <Passo numero={2} titulo="Qual é a plantação?" feito={Boolean(cultura)}>
        <div className="grid grid-cols-3 gap-2">
          {culturas.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCultura(c)}
              aria-pressed={cultura === c}
              className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 text-base font-semibold ${
                cultura === c
                  ? 'border-folha-600 bg-folha-600 text-white'
                  : 'border-gray-200 bg-white text-gray-800'
              }`}
            >
              <span className="text-3xl">{iconeDaCultura(c)}</span>
              {c}
            </button>
          ))}
        </div>
      </Passo>

      {/* 3. Descrição */}
      <Passo numero={3} titulo="O que você viu?" feito={descricao.trim().length > 0}>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value.slice(0, MAX_DESCRICAO))}
          maxLength={MAX_DESCRICAO}
          rows={4}
          placeholder="Ex.: manchas marrons nas folhas de baixo"
          className="w-full rounded-xl border-2 border-gray-200 p-3 text-base focus:border-folha-500 focus:outline-none"
        />
        <p className="text-right text-sm text-gray-500">
          {descricao.length}/{MAX_DESCRICAO}
        </p>
        <BotaoDitado onTexto={(fala) => setDescricao((atual) => juntarFala(atual, fala))} />
      </Passo>

      {/* 4. Local */}
      <Passo numero={4} titulo="Onde fica?" feito={Boolean(municipioCod)}>
        {estadoLocal !== 'manual' && (
          <BotaoGrande
            variante="secundario"
            onClick={usarMinhaLocalizacao}
            disabled={estadoLocal === 'buscando' || municipios.length === 0}
          >
            {estadoLocal === 'buscando' ? 'Procurando...' : '📍 Usar minha localização'}
          </BotaoGrande>
        )}

        {estadoLocal === 'achou' && nomeMunicipio && (
          <p className="mt-3 rounded-xl bg-folha-50 p-3 text-lg">
            Município: <strong>{nomeMunicipio}</strong>
          </p>
        )}

        {avisoLocal && <p className="mt-3 text-sm text-amber-800">{avisoLocal}</p>}

        {(estadoLocal === 'manual' || estadoLocal === 'achou') && (
          <label className="mt-3 block">
            <span className="text-sm text-gray-700">
              {estadoLocal === 'achou' ? 'Não é esse? Escolha outro:' : 'Município (SP):'}
            </span>
            <select
              value={municipioCod ?? ''}
              onChange={(e) => escolherMunicipioNaLista(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-3 text-base"
            >
              <option value="">Selecione...</option>
              {municipios.map((m) => (
                <option key={m.cod_ibge} value={m.cod_ibge}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        {estadoLocal === 'inicial' && (
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-folha-700 underline"
            onClick={() => setEstadoLocal('manual')}
          >
            Prefiro escolher na lista
          </button>
        )}
      </Passo>

      {erroEnvio && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
          {erroEnvio}
        </div>
      )}

      <BotaoGrande onClick={enviar} disabled={!podeEnviar}>
        {envio === 'enviando' ? etapa : envio === 'erro' ? 'Tentar de novo' : 'Enviar para o especialista'}
      </BotaoGrande>

      {!podeEnviar && envio !== 'enviando' && (
        <p className="text-center text-sm text-gray-600">Falta: {faltando(foto, cultura, municipioCod)}</p>
      )}
    </div>
  )
}

async function buscarListas(): Promise<[string[], Municipio[]]> {
  const [listaCulturas, { data, error }] = await Promise.all([
    buscarCulturas(),
    supabase.from('municipios').select('cod_ibge, nome, uf, lat, lon').order('nome'),
  ])
  if (error) throw error
  return [listaCulturas, data]
}

// Lista o que ainda falta preencher, em linguagem simples
function faltando(foto: File | null, cultura: string, municipio: number | null): string {
  const itens = [!foto && 'a foto', !cultura && 'a plantação', !municipio && 'o município'].filter(Boolean)
  return itens.join(', ')
}

// Acrescenta o trecho falado ao texto, com espaço e primeira letra maiúscula, sem passar do limite
function juntarFala(atual: string, fala: string): string {
  if (!fala) return atual
  const trecho = fala.charAt(0).toUpperCase() + fala.slice(1)
  const separador = atual.trim() && !/[\s]$/.test(atual) ? ' ' : ''
  return (atual + separador + trecho).slice(0, MAX_DESCRICAO)
}
