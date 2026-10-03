import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coordenadaEmSaoPaulo } from './geo.ts'

test('reconhece coordenadas dentro do estado de São Paulo', () => {
  assert.equal(coordenadaEmSaoPaulo(-21.7845, -48.178), true)
  assert.equal(coordenadaEmSaoPaulo(-23.5505, -46.6333), true)
})

test('rejeita coordenadas fora do estado, inclusive perto da divisa', () => {
  assert.equal(coordenadaEmSaoPaulo(-23.3045, -51.1696), false)
  assert.equal(coordenadaEmSaoPaulo(-25.4284, -49.2733), false)
})
