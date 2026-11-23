// lib/theme.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { THEME_PAIRS, contrastRatio, pastelFor, scoreTier } from './theme.ts'

test('every theme text pair passes 4.5:1', () => {
  assert.ok(THEME_PAIRS.length > 0)
  for (const [fg, bg] of THEME_PAIRS) assert.ok(contrastRatio(fg, bg) >= 4.5, `${fg} on ${bg}`)
})

test('contrast math matches WCAG', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) <= 0.01)
  assert.ok(Math.abs(contrastRatio('#777777', '#FFFFFF') - 4.48) <= 0.01)
})

test('the same key always gets the same pastel', () => {
  assert.equal(pastelFor('Dr. Tingting Chen'), pastelFor('Dr. Tingting Chen'))
  const seen = new Set<string>()
  for (let i = 0; i < 40; i++) seen.add(pastelFor(`Professor ${i}`))
  assert.ok(seen.size >= 3, `only ${seen.size} pastels over 40 keys`)
})

test('score tiers match the match labels', () => {
  assert.equal(scoreTier(0.6), 'strong')
  assert.equal(scoreTier(0.59), 'good')
  assert.equal(scoreTier(0.4), 'good')
  assert.equal(scoreTier(0.39), 'possible')
})
