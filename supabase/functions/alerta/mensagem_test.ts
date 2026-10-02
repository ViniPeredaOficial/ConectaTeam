// Testes da montagem do alerta: deno test supabase/functions/alerta/mensagem_test.ts
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { trechoComDose } from '../_shared/dose.ts'
import { AVISO_CATI, montarMensagem, nomesDeProdutos } from './mensagem.ts'

const base = {
  pragaComum: 'Traça-do-tomateiro',
  pragaCientifica: 'Tuta absoluta',
  municipio: 'Araraquara',
  raioKm: 15,
  cultura: 'Tomate',
  comoIdentificar: 'Minas nas folhas e furos nos frutos.',
  manejo: 'Retirar frutos atacados e monitorar duas vezes por semana.',
  produtos: ['Bioin-Tricho-P', 'Pretiobug'],
  simulado: false,
}

Deno.test('termina sempre com o aviso da CATI (regra 4 e CHECK do banco)', () => {
  const { html, texto } = montarMensagem(base)
  assert(texto.endsWith(AVISO_CATI))
  assert(html.endsWith(`<b>${AVISO_CATI}</b>`))
})

Deno.test('escapa HTML do texto do especialista', () => {
  const { html, texto } = montarMensagem({ ...base, manejo: 'Use <script> & cuidado > tudo' })
  assertStringIncludes(html, 'Use &lt;script&gt; &amp; cuidado &gt; tudo')
  assertStringIncludes(texto, 'Use <script> & cuidado > tudo')
})

Deno.test('marca dado simulado e omite campos vazios', () => {
  const { texto } = montarMensagem({ ...base, simulado: true, comoIdentificar: '  ', produtos: [] })
  assert(texto.startsWith('🧪 SIMULADO'))
  assert(!texto.includes('Como identificar'))
  assert(!texto.includes('Produtos registrados'))
})

Deno.test('título em texto puro', () => {
  assertEquals(montarMensagem(base).titulo, 'Alerta de praga: Traça-do-tomateiro (Tuta absoluta)')
  assertEquals(montarMensagem({ ...base, pragaComum: null }).titulo, 'Alerta de praga: Tuta absoluta')
})

Deno.test('mensagem normal cabe na legenda de foto (1024)', () => {
  assert(montarMensagem(base).texto.length <= 1024)
})

Deno.test('nomes de produtos: separa marcas com ";", sem repetir, no máximo 5', () => {
  assertEquals(
    nomesDeProdutos(['Trichocare P; Trichofort P', 'Hunter', 'Hunter', 'A', 'B', 'C', 'D']),
    ['Trichocare P', 'Hunter', 'A', 'B', 'C'],
  )
})

Deno.test('trava de dose no servidor', () => {
  assertEquals(trechoComDose('Aplicar 2 L/ha'), '2 L/ha')
  assertEquals(trechoComDose('300 mL/100 L de água'), '300 mL/100 L')
  assertEquals(trechoComDose('repetir a cada 7 dias, retirar 10 plantas'), null)
})
