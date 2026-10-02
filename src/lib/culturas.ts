import { supabase } from './supabase'

// Ícone de cada cultura (chave em minúsculas e sem acento)
const ICONES: Record<string, string> = {
  tomate: '🍅',
  cafe: '☕',
  alface: '🥬',
}

export function iconeDaCultura(cultura: string): string {
  const chave = cultura.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return ICONES[chave] ?? '🌱'
}

// Culturas que existem na base do Agrofit importada (sem repetir, em ordem alfabética)
export async function buscarCulturas(): Promise<string[]> {
  const { data, error } = await supabase.from('agrofit_pragas').select('cultura')
  if (error) throw error
  return [...new Set(data.map((linha) => linha.cultura as string))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
