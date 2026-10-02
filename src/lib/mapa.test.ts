// Testes do agrupamento do mapa: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agruparPorPraga, posicaoNoAnel, raioDoCirculo } from './mapa.ts'
import type { AlertaDoMapa } from './mapa.ts'

const araraquara = { nome: 'Araraquara', lat: -21.78, lon: -48.17 }
let n = 0
const alerta = (praga: string, cod = 3503208, municipios: AlertaDoMapa['municipios'] = araraquara): AlertaDoMapa => ({
  id: String(++n),
  enviado_em: '2026-10-02T12:00:00Z',
  cultura: 'Alface',
  praga_nome_comum: praga,
  praga_nome_cientifico: null,
  simulado: false,
  municipio_cod: cod,
  municipios,
})

test('caso real: 3 pragas em Araraquara viram 3 círculos, o de mais alertas primeiro', () => {
  const grupos = agruparPorPraga([
    alerta('Mancha-de-Alternaria; Pinta-preta-grande; Pinta preta'),
    alerta('Mancha-de-Alternaria; Pinta-preta-grande; Pinta preta'),
    alerta('Míldio'),
    alerta('Septoriose'),
    alerta('Míldio'),
    alerta('Míldio'),
  ])
  assert.deepEqual(
    grupos.map((g) => [g.praga, g.alertas.length]),
    [['Míldio', 3], ['Mancha-de-Alternaria', 2], ['Septoriose', 1]],
  )
})

test('mesma praga em municípios diferentes = círculos diferentes; sem município é ignorado', () => {
  const grupos = agruparPorPraga([
    alerta('Míldio'),
    alerta('Míldio', 3548906, { nome: 'São Carlos', lat: -22.01, lon: -47.89 }),
    alerta('Míldio', 1, null),
  ])
  assert.deepEqual(grupos.map((g) => g.municipio).sort(), ['Araraquara', 'São Carlos'])
})

test('raio cresce com os alertas e tem limite', () => {
  assert.equal(raioDoCirculo(1), 9)
  assert.equal(raioDoCirculo(3), 19)
  assert.equal(raioDoCirculo(50), 26)
})

test('anel: um círculo fica no centro; vários não se cobrem', () => {
  assert.deepEqual(posicaoNoAnel(0, 1, 20), { dx: 0, dy: 0 })
  for (const total of [2, 3, 5, 8]) {
    const pontos = Array.from({ length: total }, (_, i) => posicaoNoAnel(i, total, 20))
    for (let i = 0; i < total; i++) {
      const proximo = pontos.at((i + 1) % total)!
      const distancia = Math.hypot(pontos[i].dx - proximo.dx, pontos[i].dy - proximo.dy)
      assert.ok(distancia >= 2 * 20, `${total} círculos: vizinhos a ${distancia.toFixed(1)} px`)
    }
  }
  assert.deepEqual(posicaoNoAnel(0, 3, 20), { dx: 0, dy: -27 }) // o primeiro fica em cima
})
