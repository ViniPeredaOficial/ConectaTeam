const RELATIVO = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function tempoRelativo(data: string, agora = Date.now()): string {
  const instante = new Date(data).getTime()
  if (!Number.isFinite(instante)) return ''

  const segundos = Math.round((instante - agora) / 1000)
  const absoluto = Math.abs(segundos)
  if (absoluto < 60) return RELATIVO.format(segundos, 'second')
  if (absoluto < 3600) return RELATIVO.format(Math.round(segundos / 60), 'minute')
  if (absoluto < 86400) return RELATIVO.format(Math.round(segundos / 3600), 'hour')
  return RELATIVO.format(Math.round(segundos / 86400), 'day')
}
