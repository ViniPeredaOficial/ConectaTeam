// Testes da limpeza do ditado por voz: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escolherAlternativa, removerRepeticoes } from './fala.ts'

test('caso real do Android: frase acumulada repetida vira uma só', () => {
  // Sequência que o Chrome do Android entregou no teste (cada uma como "final")
  const trechos = [
    ...Array(7).fill('Alface'),
    ...Array(4).fill('Alface com músicas'),
    ...Array(4).fill('Alface com músicas verdes'),
    ...Array(4).fill('Alface com músicas verdes Claras'),
    ...Array(4).fill('Alface com músicas verdes Claras amareladas'),
  ]
  assert.equal(removerRepeticoes(trechos), 'Alface com músicas verdes Claras amareladas')
})

test('computador: trechos diferentes em sequência são somados', () => {
  assert.equal(
    removerRepeticoes(['manchas marrons nas folhas', 'e alguns furos nos frutos']),
    'manchas marrons nas folhas e alguns furos nos frutos',
  )
})

test('versão menor depois da maior é descartada; vazios ignorados', () => {
  assert.equal(removerRepeticoes(['Alface com manchas', '', 'alface com', '  ']), 'Alface com manchas')
})

test('escolhe a interpretação com palavras do campo', () => {
  assert.equal(
    escolherAlternativa(['alface com músicas verdes claras', 'alface com manchas verdes claras']),
    'alface com manchas verdes claras',
  )
})

test('empate ou alternativa única: fica a primeira', () => {
  assert.equal(escolherAlternativa(['bom dia', 'bom tia']), 'bom dia')
  assert.equal(escolherAlternativa(['folhas secas']), 'folhas secas')
  assert.equal(escolherAlternativa([]), '')
})
