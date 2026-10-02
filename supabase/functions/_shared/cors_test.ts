// Testes do CORS: deno test supabase/functions/_shared/cors_test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { origemPermitida } from './cors.ts'

const lista = [
  'http://localhost:5173',
  'https://conectateam.vercel.app',
  'https://conectateam-*-ponto-de-retorno.vercel.app',
]

Deno.test('origens exatas', () => {
  assertEquals(origemPermitida('http://localhost:5173', lista), true)
  assertEquals(origemPermitida('https://conectateam.vercel.app', lista), true)
  assertEquals(origemPermitida('http://localhost:3000', lista), false)
})

Deno.test('previews do Vercel do time liberados pelo curinga', () => {
  assertEquals(origemPermitida('https://conectateam-git-fix-ditado-android-ponto-de-retorno.vercel.app', lista), true)
  assertEquals(origemPermitida('https://conectateam-bc7gdook2-ponto-de-retorno.vercel.app', lista), true)
})

Deno.test('curinga não deixa passar domínio de fora', () => {
  assertEquals(origemPermitida('https://conectateam-x-ponto-de-retorno.vercel.app.site-malicioso.com', lista), false)
  assertEquals(origemPermitida('https://conectateam-x.site-malicioso.com/-ponto-de-retorno.vercel.app', lista), false)
  assertEquals(origemPermitida('https://site-malicioso.com', lista), false)
  assertEquals(origemPermitida('https://conectateam--ponto-de-retorno.vercel.app', lista), false)
  assertEquals(origemPermitida('', lista), false)
})
