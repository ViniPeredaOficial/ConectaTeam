// Testes do apoio aos gráficos: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diaCurto, indiceMaisProximo, marcasDoEixo } from './graficos.ts'

test('eixo Y com marcas redondas e teto acima do máximo', () => {
  assert.deepEqual(marcasDoEixo(0), [0, 1])
  assert.deepEqual(marcasDoEixo(3), [0, 1, 2, 3])
  assert.deepEqual(marcasDoEixo(7), [0, 2, 4, 6, 8])
  assert.deepEqual(marcasDoEixo(18), [0, 5, 10, 15, 20])
  assert.deepEqual(marcasDoEixo(140), [0, 50, 100, 150])
})

test('marcas são sempre inteiras (contagens)', () => {
  for (const m of [1, 2, 3, 5, 9, 11, 27, 99]) {
    assert.ok(marcasDoEixo(m).every(Number.isInteger), `máximo ${m}`)
    assert.ok(marcasDoEixo(m).at(-1)! >= m)
  }
})

test('dia curto e ponto mais próximo do cursor', () => {
  assert.equal(diaCurto('2026-10-02'), '02/10')
  assert.equal(indiceMaisProximo(0, 30), 0)
  assert.equal(indiceMaisProximo(1, 30), 29)
  assert.equal(indiceMaisProximo(0.5, 30), 15)
  assert.equal(indiceMaisProximo(1.4, 30), 29)
  assert.equal(indiceMaisProximo(0.3, 1), 0)
})
