import { supabase } from './supabase'
import type { AlertaDoMapa } from './mapa'

export type AlertaPublico = AlertaDoMapa & {
  municipios: NonNullable<AlertaDoMapa['municipios']>
  canal_enviado: boolean
  destinatarios: number
}

type AlertaConsultado = Omit<AlertaPublico, 'municipios'> & {
  municipios: AlertaDoMapa['municipios']
}

const DIAS_BUSCA = 30

// Carrega apenas alertas publicados e a coordenada pública do centro do município.
export async function buscarAlertasPublicos(): Promise<AlertaPublico[]> {
  const desde = new Date(Date.now() - DIAS_BUSCA * 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('alertas')
    .select(
      'id, enviado_em, cultura, praga_nome_comum, praga_nome_cientifico, simulado, canal_enviado, destinatarios, ' +
        'municipio_cod, municipios(nome, lat, lon)',
    )
    .gte('enviado_em', desde)
    .order('enviado_em', { ascending: false })
    .returns<AlertaConsultado[]>()

  if (error) throw error
  return data.filter(
    (alerta): alerta is AlertaPublico =>
      Boolean(alerta.municipios) && (alerta.simulado || alerta.canal_enviado || alerta.destinatarios > 0),
  )
}
