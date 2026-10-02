// Testes do risco climático: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularRisco, nivelPorHoras, pesoDoRisco } from './clima.ts'

// Monta N horas iguais
const horas = (n: number, temperatura: number, umidade: number, chuva = 0) => ({
  temperatura: Array(n).fill(temperatura),
  umidade: Array(n).fill(umidade),
  chuva: Array(n).fill(chuva),
})
const juntar = (...partes: ReturnType<typeof horas>[]) => ({
  temperatura: partes.flatMap((p) => p.temperatura),
  umidade: partes.flatMap((p) => p.umidade),
  chuva: partes.flatMap((p) => p.chuva),
})

test('limites de nível: 12 h alto, 6 h médio', () => {
  assert.equal(nivelPorHoras(12), 'alto')
  assert.equal(nivelPorHoras(11), 'medio')
  assert.equal(nivelPorHoras(6), 'medio')
  assert.equal(nivelPorHoras(5), 'baixo')
})

test('fungos: umidade alta com temperatura amena', () => {
  const r = calcularRisco(juntar(horas(14, 20, 95), horas(58, 24, 70)))
  assert.deepEqual(r.fungos, { nivel: 'alto', horas: 14 })
  assert.equal(r.seco.nivel, 'baixo')
})

test('fungos: umidade alta fora da faixa de temperatura não conta', () => {
  const r = calcularRisco(juntar(horas(10, 8, 98), horas(10, 30, 95)))
  assert.equal(r.fungos.horas, 0)
})

test('tempo quente e seco favorece mosca-branca e ácaros', () => {
  const r = calcularRisco(juntar(horas(8, 32, 35), horas(64, 22, 70)))
  assert.deepEqual(r.seco, { nivel: 'medio', horas: 8 })
})

test('chuva acumulada e temperaturas mínima e máxima', () => {
  const r = calcularRisco(juntar(horas(2, 15, 80, 1.25), horas(2, 29, 60, 0.5)))
  assert.equal(r.chuvaMm, 3.5)
  assert.equal(r.tMin, 15)
  assert.equal(r.tMax, 29)
})

test('ordem: risco alto vem antes de médio e baixo', () => {
  const alto = calcularRisco(horas(20, 20, 95))
  const medio = calcularRisco(horas(7, 20, 95))
  const baixo = calcularRisco(horas(72, 22, 60))
  assert.ok(pesoDoRisco(alto) > pesoDoRisco(medio))
  assert.ok(pesoDoRisco(medio) > pesoDoRisco(baixo))
})
