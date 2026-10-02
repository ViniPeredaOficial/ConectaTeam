// Redefine a senha de um produtor (uso da equipe enquanto não existe recuperação por SMS).
//
// Uso (Git Bash), na raiz do projeto:
//   SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/redefinir_senha.mjs "(16) 99999-8888" <nova-senha>
//
// A service_role fica só na variável do terminal: nunca em arquivo nem no front.
// A URL do projeto vem do .env (VITE_SUPABASE_URL), que não é segredo.

import { readFileSync } from 'node:fs'
import { emailDoCelular, normalizarCelular } from '../src/lib/celular.ts'

const [celular, novaSenha] = process.argv.slice(2)
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
const URL =
  process.env.SUPABASE_URL ?? readFileSync('.env', 'utf8').match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim()

if (!celular || !novaSenha || !CHAVE || !URL) {
  console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=<chave> node scripts/redefinir_senha.mjs "<celular>" <nova-senha>')
  process.exit(1)
}
if (novaSenha.length < 6) {
  console.error('A senha precisa ter pelo menos 6 caracteres.')
  process.exit(1)
}

const numero = normalizarCelular(celular)
if (!numero) {
  console.error('Celular inválido. Use DDD + número, ex.: (16) 99999-8888.')
  process.exit(1)
}
const email = emailDoCelular(numero)
const cabecalhos = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' }

// Procura o usuário pelo e-mail interno (lista paginada da API de administração)
let usuario
for (let pagina = 1; !usuario; pagina++) {
  const r = await fetch(`${URL}/auth/v1/admin/users?page=${pagina}&per_page=500`, { headers: cabecalhos })
  if (!r.ok) {
    console.error(`Falha ao listar usuários (HTTP ${r.status}). Confira a chave.`)
    process.exit(1)
  }
  const { users } = await r.json()
  if (!users.length) break
  usuario = users.find((u) => u.email === email)
}
if (!usuario) {
  console.error('Nenhuma conta com esse celular.')
  process.exit(1)
}

const r = await fetch(`${URL}/auth/v1/admin/users/${usuario.id}`, {
  method: 'PUT',
  headers: cabecalhos,
  body: JSON.stringify({ password: novaSenha }),
})
console.log(r.ok ? 'Senha redefinida. Avise o produtor da nova senha.' : `Falha ao redefinir (HTTP ${r.status}).`)
