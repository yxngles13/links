// lib/similarity.test.ts — run with `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayScore, scoreFor } from './similarity.ts'

test('a professor with no stored vector scores 0', () => {
  assert.equal(scoreFor([1, 0], null), 0)
})

test('vectors arrive as PostgREST strings and still score', () => {
  assert.equal(scoreFor([1, 0], '[1,0]'), 1)
  assert.equal(scoreFor([1, 0], '[0,1]'), 0)
})

test('shown scores line up with the match labels', () => {
  assert.equal(displayScore(0.4), 70) // Good starts here
  assert.equal(displayScore(0.6), 90) // Strong starts here
  assert.equal(displayScore(0.51), 81)
})

test('shown scores stay between 40 and 99', () => {
  assert.equal(displayScore(0), 40)
  assert.equal(displayScore(-0.3), 40)
  assert.equal(displayScore(0.2), 40)
  assert.equal(displayScore(0.75), 99)
  assert.equal(displayScore(1), 99)
})

test('a closer match never shows a lower score', () => {
  for (let x = 0; x < 1; x += 0.01) assert.ok(displayScore(x + 0.01) >= displayScore(x))
})
