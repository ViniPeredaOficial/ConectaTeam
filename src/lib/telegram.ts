// Endereços públicos do Radar de Pragas no Telegram
export const BOT_USUARIO = 'ConectaTeamBot'
export const URL_BOT = `https://t.me/${BOT_USUARIO}`
export const URL_CANAL = 'https://t.me/radardepragas_araraquara'

// Link que abre o bot já com o código de uso único para ligar a conta
export function linkParaLigarConta(codigo: string): string {
  return `${URL_BOT}?start=${codigo}`
}
