// Testes do login por celular: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emailDoCelular, mascararCelular, normalizarCelular } from './celular.ts'

test('aceita os formatos comuns de celular', () => {
  for (const entrada of ['(16) 99999-8888', '16999998888', '016 99999 8888', '+55 16 99999-8888', '5516999998888']) {
    assert.equal(normalizarCelular(entrada), '5516999998888', entrada)
  }
})

test('recusa número inválido', () => {
  assert.equal(normalizarCelular('(16) 3333-4444'), null) // fixo, 10 dígitos
  assert.equal(normalizarCelular('(16) 89999-8888'), null) // celular não começa com 9
  assert.equal(normalizarCelular('(20) 99999-8888'), null) // DDD inexistente
  assert.equal(normalizarCelular('9999-8888'), null) // sem DDD
  assert.equal(normalizarCelular(''), null)
})

test('e-mail interno do login', () => {
  assert.equal(emailDoCelular('5516999998888'), '5516999998888@celular.radardepragas.app')
})

test('máscara enquanto digita', () => {
  assert.equal(mascararCelular('1'), '(1')
  assert.equal(mascararCelular('16'), '(16')
  assert.equal(mascararCelular('16999'), '(16) 999')
  assert.equal(mascararCelular('16999998888'), '(16) 99999-8888')
  assert.equal(mascararCelular('(16) 99999-88889999'), '(16) 99999-8888')
})
