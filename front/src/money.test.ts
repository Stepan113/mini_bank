import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAmount } from './money.ts'

test('суммы переводятся в целые копейки без округления', () => {
  assert.equal(parseAmount('0,01'), 1)
  assert.equal(parseAmount('12.50'), 1250)
  assert.equal(parseAmount('19,9'), 1990)
  assert.equal(parseAmount('1000000'), 100_000_000)
})

test('неприемлемые суммы отклоняются, а не округляются', () => {
  for (const value of ['', '0', '-1', '1.001', '1000000.01', '1e3', 'NaN', '1,2.3']) {
    assert.equal(parseAmount(value), null, value)
  }
})
