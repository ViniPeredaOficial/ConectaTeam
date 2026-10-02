// Testes do aviso ao produtor: deno test supabase/functions/avisar-produtor/mensagem_test.ts
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { trechoComDose } from '../_shared/dose.ts'
import { codigoDoStart } from '../_shared/telegram.ts'
import { AVISO_CATI, mensagemAoProdutor } from './mensagem.ts'

const base = {
  status: 'analisado' as const,
  cultura: 'Tomate',
  enviadoEm: '2026-10-02T13:00:00Z',
  pragaComum: 'Traça-do-tomateiro',
  pragaCientifica: 'Tuta absoluta',
  urlApp: 'https://conectateam.vercel.app',
}

Deno.test('analisado: praga, data, link e aviso da CATI no final', () => {
  const m = mensagemAoProdutor(base)
  assertStringIncludes(m, 'Seu chamado foi respondido')
  assertStringIncludes(m, '<b>Traça-do-tomateiro</b> (<i>Tuta absoluta</i>)')
  assertStringIncludes(m, 'Tomate enviado em 02/10')
  assertStringIncludes(m, 'https://conectateam.vercel.app/produtor/chamados')
  assert(m.endsWith(`<b>${AVISO_CATI}</b>`))
})

Deno.test('usa só o primeiro nome comum e escapa HTML', () => {
  const m = mensagemAoProdutor({ ...base, pragaComum: 'ferrugem<x>; Ferrugem', cultura: 'Café & cia' })
  assertStringIncludes(m, '<b>ferrugem&lt;x&gt;</b>')
  assertStringIncludes(m, 'Café &amp; cia')
})

Deno.test('descartado: orienta enviar nova foto, termina com a CATI', () => {
  const m = mensagemAoProdutor({ ...base, status: 'descartado', pragaComum: null, pragaCientifica: null })
  assertStringIncludes(m, 'encerrado')
  assertStringIncludes(m, 'https://conectateam.vercel.app/produtor')
  assert(m.endsWith(`<b>${AVISO_CATI}</b>`))
})

Deno.test('aviso nunca contém dose', () => {
  assertEquals(trechoComDose(mensagemAoProdutor(base)), null)
})

Deno.test('lê o código do /start', () => {
  const codigo = 'a'.repeat(16) + '0123456789abcdef'
  assertEquals(codigoDoStart(`/start ${codigo}`), codigo)
  assertEquals(codigoDoStart(`/start@ConectaTeamBot ${codigo}`), codigo)
  assertEquals(codigoDoStart('/start'), null)
  assertEquals(codigoDoStart('/start abc'), null)
  assertEquals(codigoDoStart(`/sair ${codigo}`), null)
})
