// Tipos das tabelas do banco (espelham supabase/migrations/20261002120000_schema_inicial.sql).
// Tabelas agrofit_* ajustadas em 20261002150000_agrofit_ajustes.sql.

export type Papel = 'produtor' | 'especialista'
export type StatusChamado = 'em_analise' | 'analisado' | 'descartado'
export type ImagemAlerta = 'foto_produtor' | 'referencia' | 'nenhuma'

export interface Perfil {
  id: string
  papel: Papel
  nome: string | null
  criado_em: string
}

export interface Municipio {
  cod_ibge: number
  nome: string
  uf: string
  lat: number
  lon: number
}

export interface AgrofitPraga {
  id: number
  cultura: string
  cultura_busca: string // minúsculas, sem acento
  praga_nome_comum: string | null // vários nomes separados por "; "
  praga_nome_cientifico: string
  praga_busca: string // científico + comuns, minúsculas, sem acento
}

export interface AgrofitProduto {
  id: number
  nr_registro: string
  cultura: string
  cultura_busca: string
  praga_nome_cientifico: string
  classe: string | null // Inseticida, Fungicida...
  marca_comercial: string
  ingrediente_ativo: string | null
  classe_toxicologica: string | null
  organico: boolean
  biologico: boolean
}

export interface Chamado {
  id: string
  produtor_id: string
  cultura: string
  descricao: string | null
  foto_path: string | null
  municipio_cod: number | null
  status: StatusChamado
  simulado: boolean
  criado_em: string
}

// Só o próprio produtor lê. Nunca exibir em tela (regra 6).
export interface ChamadoLocalizacao {
  chamado_id: string
  lat: number
  lon: number
}

// Produto citado numa candidata (sem dose: regra 4)
export type ProdutoSugerido = Pick<
  AgrofitProduto,
  'marca_comercial' | 'ingrediente_ativo' | 'classe' | 'classe_toxicologica' | 'organico' | 'biologico'
>

export interface Candidata {
  praga_nome_comum: string | null
  praga_nome_cientifico: string
  confianca: number // 0 a 1
  justificativa: string
  produtos: ProdutoSugerido[]
}

export interface SugestaoIA {
  id: string
  chamado_id: string
  candidatas: Candidata[]
  modelo: string | null
  erro: string | null // falha técnica (timeout, API fora); nulo se ok
  observacao: string | null // explicação da IA quando não identifica a praga
  criado_em: string
}

export interface Validacao {
  id: string
  chamado_id: string
  especialista_id: string
  praga_nome_comum: string | null
  praga_nome_cientifico: string
  ia_acertou: boolean | null // null: a IA não sugeriu nada
  como_identificar: string | null
  manejo: string | null
  imagem_alerta: ImagemAlerta
  imagem_path: string | null
  criado_em: string
}

export interface Alerta {
  id: string
  validacao_id: string
  municipio_cod: number | null
  raio_km: number
  titulo: string
  texto: string
  imagem_url: string | null
  simulado: boolean
  enviado_em: string
  destinatarios: number // inscritos que receberam
  canal_enviado: boolean
}

// Linha da view vw_fila_especialista (sem coordenada e sem produtor_id)
export interface FilaEspecialista {
  id: string
  cultura: string
  descricao: string | null
  foto_path: string | null
  municipio_cod: number | null
  municipio_nome: string | null
  municipio_uf: string | null
  status: StatusChamado
  simulado: boolean
  criado_em: string
  ia_candidatas: Candidata[] | null
  ia_modelo: string | null
  ia_erro: string | null
  ia_criado_em: string | null
  ia_observacao: string | null
}
