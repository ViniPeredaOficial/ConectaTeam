// Login do produtor por celular + senha, sem SMS (plano gratuito).
// O número vira um e-mail interno do Supabase Auth; nenhuma mensagem é enviada para ele
// (a confirmação de e-mail fica desligada no projeto).

export const DOMINIO_LOGIN = 'celular.radardepragas.app'

// DDDs válidos no Brasil (Anatel)
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46,
  47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

// "(16) 99999-8888", "016 99999 8888" ou "+55 16 99999-8888" -> "5516999998888". Inválido -> null.
export function normalizarCelular(texto: string): string | null {
  let digitos = texto.replace(/\D/g, '')
  if (digitos.length === 13 && digitos.startsWith('55')) digitos = digitos.slice(2)
  digitos = digitos.replace(/^0+/, '') // prefixo de operadora/interurbano
  if (digitos.length !== 11) return null
  if (!DDDS.has(Number(digitos.slice(0, 2))) || digitos[2] !== '9') return null
  return `55${digitos}`
}

export function emailDoCelular(celularNormalizado: string): string {
  return `${celularNormalizado}@${DOMINIO_LOGIN}`
}

// Máscara enquanto digita: "16999998888" -> "(16) 99999-8888"
export function mascararCelular(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
